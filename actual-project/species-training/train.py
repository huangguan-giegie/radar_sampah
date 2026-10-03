"""Coordinate-only project models with a frozen, single cell holdout.

Selection uses only the development partition. Test results are never used to
change parameters or redraw the split. All successfully fitted species are
exported, with a separate, minimal default-recommendation flag. This evaluates
recorded-cell interpolation, not new-region transfer or true animal presence.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import time
import warnings
from collections import Counter
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.exceptions import ConvergenceWarning
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from threadpoolctl import threadpool_limits

HERE = Path(__file__).resolve().parent
DATA_ROOT = HERE / 'data'
RUNTIME_ROOT = HERE.parent / 'backend/species_distribution'
DEFAULT_REFERENCE_ROOT = RUNTIME_ROOT / 'reference'
ORIGINAL_FOUR = {'Chelonia mydas', 'Amphiprion ocellaris', 'Orcaella brevirostris', 'Zanclus cornutus'}
NAME_FIELDS = ('slug', 'scientific_name', 'common_name_en', 'common_name_zh', 'kingdom_name')
SEED = 20261003
CONFIG = {
    'model_version': 'iteration3-project-cell-holdout-20261003',
    'features': ['latitude', 'longitude'],
    'training_grid_rows': 4227,
    'grid_size_degrees': 0.1,
    'min_presence_cells': 10,
    'min_presence_blocks': None,
    'scope': 'marine Animalia and six marine seagrass taxa; no terrestrial coconut palm',
    'scope_exclusions': {'Cocos nucifera': 'terrestrial coconut palm'},
    'test_fraction': 0.2,
    'split_method': 'one fixed stratified split of unique 0.1-degree grid cells per species',
    'inner_folds': 3,
    'parameter_selection': 'mean development-only fold AP; mean ROC for exact AP ties; fixed candidate order last',
    'logistic_C_grid': [0.01, 0.1, 1.0],
    'forest_trees': 200,
    'forest_min_samples_leaf': 5,
    'forest_max_depth': 10,
    'background_mode': 'all_unrecorded_marine_grid_cells',
    'class_balance': 'balanced LR; balanced_subsample RF',
    'positive_label_meaning': 'at least one accepted historical OBIS observation in cell',
    'negative_label_meaning': 'unrecorded background, not confirmed absence',
    'export_policy': 'save every successfully fitted candidate model',
    'default_recommendation_rule': 'single held-out AP exceeds analytic mean AP of uniform random ranking at the same test N and P; final scores must be finite and nonconstant',
    'random_ranking_ap_formula': 'H_N/N + ((P-1)/(N-1)) * (1-H_N/N)',
    'removed_gates': ['five positive spatial blocks', 'ROC>=0.65', 'AP lift>=3', 'top10 recall>=0.30', 'three repetitions/two passes', 'latest year>=2000', 'nested one-degree spatial minimums'],
    'seed': SEED,
    'probability_calibrated': False,
    'cross_species_ranking_validated': False,
    'evaluation_scope': 'interpolation among cells in the existing observed marine domain; adjacent cells may cross partitions',
    'limits': 'small test positive counts are uncertain; random baseline comparison is not a significance test; selected-subset metrics are descriptive; neither new-region transfer nor real-world probabilities are validated',
}
SPECS = [
    {'id': f'{family}_C_{c:g}', 'family': family, 'C': c}
    for family in ('logistic_regression', 'quadratic_logistic_regression')
    for c in CONFIG['logistic_C_grid']
] + [{'id': 'random_forest_leaf_5', 'family': 'random_forest', 'min_samples_leaf': 5}]
CONFIG['model_candidates'] = SPECS
# Inputs are loaded after CLI parsing and independently in each Windows worker.
GRID = X = PRESENCE = None
CELLS = {}
AUDIT = []
BASE_SPECIES = {}
GRID_PATH = None
NAME_OVERRIDE_PATH = None


def configure_inputs(reference_root):
    global GRID, X, PRESENCE, CELLS, AUDIT, BASE_SPECIES, GRID_PATH, NAME_OVERRIDE_PATH
    reference_root = Path(reference_root).expanduser().resolve()
    GRID_PATH = reference_root / 'marine_grid.csv'
    provenance = json.loads((DATA_ROOT / 'provenance.json').read_text(encoding='utf-8'))
    local_files = [HERE / 'config.json', DATA_ROOT / 'presence_cells.json', DATA_ROOT / 'species_audit_table.json']
    for path in local_files:
        expected = provenance['processed_files'][path.name]['sha256']
        if sha(path) != expected:
            raise ValueError(f'Frozen input checksum mismatch: {path.name}')
    for name, details in provenance['reference_files'].items():
        path = reference_root / name
        if not path.is_file():
            raise FileNotFoundError(f'Reference file missing: {name}. Use --reference-dir with the frozen reference directory.')
        if sha(path) != details['sha256']:
            raise ValueError(f'Frozen reference checksum mismatch: {name}')
    GRID = pd.read_csv(GRID_PATH).reset_index(drop=True)
    X = GRID[CONFIG['features']]
    PRESENCE = pd.read_json(DATA_ROOT / 'presence_cells.json')
    CELLS = {str(name): set(rows.cell_id) for name, rows in PRESENCE.groupby('target_species')}
    AUDIT = json.loads((DATA_ROOT / 'species_audit_table.json').read_text(encoding='utf-8'))
    configuration = json.loads((HERE / 'config.json').read_text(encoding='utf-8'))
    BASE_SPECIES = {s['scientific_name']: {k: s[k] for k in NAME_FIELDS} for s in configuration['species']}
    if len(BASE_SPECIES) != 157 or set(BASE_SPECIES) != {r['scientific_name'] for r in AUDIT}:
        raise ValueError('The frozen name configuration and audit must cover the same 157 species.')
    NAME_OVERRIDE_PATH = RUNTIME_ROOT / 'models/model_manifest.json'
    if NAME_OVERRIDE_PATH.is_file():
        runtime_manifest = json.loads(NAME_OVERRIDE_PATH.read_text(encoding='utf-8'))
        for item in runtime_manifest['species']:
            name = item['scientific_name']
            if name not in BASE_SPECIES:
                continue
            # Runtime model/evaluation/ranking fields never change training.
            for key in ('slug', 'common_name_en', 'common_name_zh'):
                if key in item and not (key == 'slug' and name in ORIGINAL_FOUR):
                    BASE_SPECIES[name][key] = item[key]
    else:
        NAME_OVERRIDE_PATH = None
    identifiers = [item['slug'] for item in BASE_SPECIES.values()]
    if len(identifiers) != len(set(identifiers)) or any(not re.fullmatch(r'[a-z0-9_]+', value) for value in identifiers):
        raise ValueError('Species slugs must be unique safe lower-case file identifiers.')


def output_directory(value, reference_root):
    root = Path(value).expanduser().resolve()
    protected = [DATA_ROOT.resolve(), (HERE.parent / 'backend').resolve(), Path(reference_root).resolve()]
    if root == HERE or any(root == path or root.is_relative_to(path) or path.is_relative_to(root) for path in protected):
        raise ValueError('Output must be a separate run directory, outside inputs and application/backend directories.')
    # A clean run directory avoids mixing stale artifacts from another species set.
    if root.exists() and any(root.iterdir()):
        raise ValueError('Output directory is not empty. Choose a new run directory; existing outputs are never overwritten.')
    return root


def now():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, obj):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(obj, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    temp.replace(path)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def slug(name):
    return BASE_SPECIES.get(name, {}).get('slug', re.sub('[^a-z0-9]+', '_', name.lower()).strip('_'))


def seed_for(name, offset=0):
    return (SEED + int.from_bytes(hashlib.sha256(name.encode()).digest()[:4], 'little') + offset * 7919) % (2**31 - 1)


def random_ap_mean(n, positives):
    if not 0 < positives < n:
        raise ValueError('Random AP requires positive and background examples.')
    harmonic = float(np.sum(1 / np.arange(1, n + 1, dtype=float)))
    return harmonic / n + (positives - 1) / (n - 1) * (1 - harmonic / n)


def top_fraction_recall(labels, scores, fraction):
    n = max(1, math.ceil(fraction * len(labels)))
    cutoff = np.partition(scores, len(scores) - n)[len(scores) - n]
    above, tied = scores > cutoff, scores == cutoff
    found = labels[above].sum() + labels[tied].sum() * (n - above.sum()) / tied.sum()
    return float(found / labels.sum())


def metrics(labels, scores):
    labels, scores = np.asarray(labels), np.asarray(scores)
    assert set(labels) == {0, 1} and np.isfinite(scores).all()
    ap = float(average_precision_score(labels, scores))
    baseline = random_ap_mean(len(labels), int(labels.sum()))
    return {
        'roc_auc': float(roc_auc_score(labels, scores)),
        'average_precision': ap,
        'constant_score_ap': float(labels.mean()),
        'random_ranking_mean_ap': baseline,
        'ap_over_random_mean': ap / baseline,
        'ap_lift_over_constant': ap / float(labels.mean()),
        'top_10_percent_presence_recall': top_fraction_recall(labels, scores, 0.1),
        'rows': len(labels), 'presences': int(labels.sum()),
    }


def estimator(spec, seed):
    if spec['family'] == 'random_forest':
        return RandomForestClassifier(n_estimators=CONFIG['forest_trees'], max_depth=CONFIG['forest_max_depth'], min_samples_leaf=spec['min_samples_leaf'], class_weight='balanced_subsample', random_state=seed, n_jobs=1)
    steps = []
    if spec['family'] == 'quadratic_logistic_regression':
        steps.append(('polynomial', PolynomialFeatures(degree=2, include_bias=False)))
    steps += [('scale', StandardScaler()), ('classifier', LogisticRegression(C=spec['C'], class_weight='balanced', max_iter=2000, random_state=seed))]
    return Pipeline(steps)


def fit_model(spec, indices, labels, seed):
    model = estimator(spec, seed)
    with warnings.catch_warnings():
        warnings.simplefilter('error', ConvergenceWarning)
        model.fit(X.iloc[indices], labels[indices])
    return model


def candidate_exclusion(row):
    if row['scientific_name'] in CONFIG['scope_exclusions']:
        return CONFIG['scope_exclusions'][row['scientific_name']]
    if row['kingdom_name'] not in ('Animalia', 'Plantae'):
        return 'outside current animal/seagrass project scope'
    if row['presence_cells'] < CONFIG['min_presence_cells']:
        return 'fewer than 10 distinct accepted presence cells; not enough for this project screening design'
    return None


def candidate_rows():
    accepted, excluded = [], []
    for item in AUDIT:
        row = {k: v for k, v in item.items() if k != 'tier'}
        reason = candidate_exclusion(row)
        if reason:
            excluded.append({**row, 'exclusion_reason': reason})
        else:
            accepted.append(row)
    return sorted(accepted, key=lambda r: r['scientific_name']), excluded


def make_partitions(name, labels):
    development, test = train_test_split(np.arange(len(GRID)), test_size=CONFIG['test_fraction'], stratify=labels, random_state=seed_for(name))
    development, test = np.sort(development), np.sort(test)
    cv = StratifiedKFold(n_splits=CONFIG['inner_folds'], shuffle=True, random_state=seed_for(name, 1))
    folds = [(development[tr], development[te]) for tr, te in cv.split(development, labels[development])]
    assert not set(development) & set(test)
    assert set(development) | set(test) == set(range(len(GRID)))
    for train, valid in folds:
        assert not set(train) & set(valid) and not (set(train) | set(valid)) & set(test)
        assert set(labels[train]) == set(labels[valid]) == {0, 1}
    return development, test, folds


def select_parameters(labels, folds, seed):
    evaluations = []
    for spec in SPECS:
        row = {'parameters': spec}
        try:
            fold_results = []
            for i, (train, valid) in enumerate(folds):
                model = fit_model(spec, train, labels, seed + i)
                fold_results.append(metrics(labels[valid], model.predict_proba(X.iloc[valid])[:, 1]))
            row.update(fold_metrics=fold_results, mean_ap=float(np.mean([f['average_precision'] for f in fold_results])), mean_roc_auc=float(np.mean([f['roc_auc'] for f in fold_results])))
        except Exception as exc:
            row['error'] = f'{type(exc).__name__}: {exc}'
        evaluations.append(row)
    valid = [v for v in evaluations if 'error' not in v]
    if not valid:
        raise RuntimeError('All development model candidates failed.')
    chosen = max(valid, key=lambda r: (r['mean_ap'], r['mean_roc_auc']))
    return chosen['parameters'], evaluations


def worker_init(reference_root):
    global _LIMITER
    configure_inputs(reference_root)
    _LIMITER = threadpool_limits(limits=1)


def train_species(row, root_string, config_hash):
    root, name = Path(root_string), row['scientific_name']
    started = time.perf_counter()
    result = {**row, 'slug': slug(name), 'status': 'training', 'default_recommendation': False}
    try:
        labels = GRID.cell_id.isin(CELLS[name]).to_numpy(dtype=np.int8)
        development, test, folds = make_partitions(name, labels)
        spec, selection = select_parameters(labels, folds, seed_for(name, 2))
        evaluation_model = fit_model(spec, development, labels, seed_for(name, 3))
        test_scores = evaluation_model.predict_proba(X.iloc[test])[:, 1]
        test_metrics = metrics(labels[test], test_scores)
        model = fit_model(spec, np.arange(len(GRID)), labels, seed_for(name, 4))
        grid_scores = model.predict_proba(X)[:, 1]
        finite = bool(np.isfinite(grid_scores).all() and ((grid_scores >= 0) & (grid_scores <= 1)).all())
        nonconstant = bool(finite and float(np.ptp(grid_scores)) > 1e-12)
        recommended = bool(nonconstant and test_metrics['average_precision'] > test_metrics['random_ranking_mean_ap'])
        status = 'baseline_supported' if recommended else 'holdout_evidence_weak' if nonconstant else 'no_location_variation'
        species = {**BASE_SPECIES.get(name, {'slug': slug(name), 'scientific_name': name, 'common_name_en': name, 'common_name_zh': ''}), 'kingdom_name': row['kingdom_name']}
        result.update(status='trained', validation_status=status, selected_model=spec['family'], selected_parameters=spec, test_metrics=test_metrics, default_recommendation=recommended, final_scores_finite=finite, final_scores_nonconstant=nonconstant, development_rows=len(development), development_presences=int(labels[development].sum()), test_rows=len(test), test_presences=int(labels[test].sum()), score_min=float(grid_scores.min()), score_max=float(grid_scores.max()), historical_only=bool(row['max_year'] is not None and row['max_year'] < 2000), uncertainty_note='test positives fewer than 5: high sampling uncertainty' if labels[test].sum() < 5 else 'single fixed cell split; not a new-region or ecological survey validation')
        bundle = {'model': model, 'model_name': spec['family'], 'selected_parameters': spec, 'species': species, 'features': CONFIG['features'], 'training_rows': len(GRID), 'presence_rows': int(labels.sum()), 'config_hash': config_hash, 'background_mode': CONFIG['background_mode'], 'validation': {'method': CONFIG['split_method'], 'test_metrics': test_metrics, 'default_recommendation': recommended}, 'score_interpretation': 'relative historical occurrence score; not calibrated probability'}
        artifact = root / 'models' / f'{slug(name)}.joblib'
        joblib.dump(bundle, artifact, compress=3)
        joblib.dump({'model': evaluation_model, 'selected_parameters': spec, 'development_indices': development}, root / 'evaluation_models' / f'{slug(name)}.joblib', compress=3)
        saved = {'labels': labels, 'development_indices': development, 'test_indices': test, 'test_scores': test_scores, 'final_grid_scores': grid_scores}
        membership = np.full(len(GRID), -1, dtype=np.int8)
        for i, (_, valid) in enumerate(folds):
            membership[valid] = i
        saved['inner_fold_membership'] = membership
        np.savez_compressed(root / 'validation_predictions' / f'{slug(name)}.npz', **saved)
        write_json(root / 'parameter_selection' / f'{slug(name)}.json', {'selected_parameters': spec, 'candidates': selection, 'selection_data': 'development partition only; test untouched', 'config_hash': config_hash})
        result['manifest_entry'] = {**species, **{k: result[k] for k in ('selected_model', 'selected_parameters', 'presence_cells', 'spatial_blocks', 'source_datasets', 'min_year', 'max_year', 'test_metrics', 'default_recommendation', 'validation_status', 'test_presences', 'historical_only', 'uncertainty_note')}, 'selected_model_path': f'models/{artifact.name}', 'model_file_bytes': artifact.stat().st_size, 'model_sha256': sha(artifact)}
    except Exception as exc:
        result.update(status='training_error', error=f'{type(exc).__name__}: {exc}')
    result['elapsed_seconds'] = round(time.perf_counter() - started, 3)
    write_json(root / 'results' / f'{slug(name)}.json', result)
    return result


def integrity():
    assert len(GRID) == GRID.cell_id.nunique() == 4227
    assert not PRESENCE.duplicated(['target_species', 'cell_id']).any()
    assert set(PRESENCE.cell_id) <= set(GRID.cell_id)
    joined = PRESENCE.merge(GRID[['cell_id', 'latitude', 'longitude']], on='cell_id', suffixes=('_p', '_g'))
    assert np.allclose(joined.latitude_p, joined.latitude_g) and np.allclose(joined.longitude_p, joined.longitude_g)
    accepted, _ = candidate_rows()
    for row in accepted:
        assert len(CELLS[row['scientific_name']]) == row['presence_cells']
        labels = GRID.cell_id.isin(CELLS[row['scientific_name']]).to_numpy(dtype=np.int8)
        dev, test, _ = make_partitions(row['scientific_name'], labels)
        assert labels[dev].sum() >= 8 and labels[test].sum() >= 2
    return accepted


def main():
    parser = argparse.ArgumentParser(description='Replay the frozen Iteration 3 coordinate-only training design offline.')
    parser.add_argument('--workers', type=int, default=4, help='Concurrent species workers (each numerical model uses one thread).')
    parser.add_argument('--species', action='append', metavar='SCIENTIFIC_NAME', help='Exact scientific name. Repeat to train several species; omission trains all 157.')
    parser.add_argument('--output-dir', type=Path, default=HERE / 'runs/current', help='A new, empty output directory. Defaults to species-training/runs/current.')
    parser.add_argument('--reference-dir', type=Path, default=DEFAULT_REFERENCE_ROOT, help='Frozen marine_grid.csv and EEZ directory. Defaults to ../backend/species_distribution/reference.')
    parser.add_argument('--prepare-only', action='store_true', help='Validate and freeze configuration/inputs without fitting models.')
    args = parser.parse_args()
    if args.workers < 1:
        parser.error('--workers must be at least 1')
    started = time.perf_counter()
    reference_root = args.reference_dir.expanduser().resolve()
    configure_inputs(reference_root)
    all_candidates = integrity()
    candidates, excluded = candidate_rows()
    if args.species:
        requested = set(args.species)
        missing = requested - {r['scientific_name'] for r in candidates}
        if missing:
            parser.error('Unknown frozen candidate scientific names: ' + ', '.join(sorted(missing)))
        candidates = [r for r in candidates if r['scientific_name'] in requested]
    root = output_directory(args.output_dir, reference_root)
    config_hash = hashlib.sha256(json.dumps(CONFIG, sort_keys=True).encode()).hexdigest()
    provenance = json.loads((DATA_ROOT / 'provenance.json').read_text(encoding='utf-8'))
    if config_hash != provenance['original_training_config_hash']:
        raise ValueError('The original training CONFIG hash changed; this is no longer an unchanged replay.')
    for directory in ('models', 'results', 'evaluation_models', 'validation_predictions', 'parameter_selection', 'reference'):
        (root / directory).mkdir(parents=True, exist_ok=True)
    files = {
        'data/presence_cells.json': DATA_ROOT / 'presence_cells.json',
        'data/species_audit_table.json': DATA_ROOT / 'species_audit_table.json',
        'data/provenance.json': DATA_ROOT / 'provenance.json',
        'config.json': HERE / 'config.json',
        'reference/marine_grid.csv': GRID_PATH,
        'reference/malaysia_eez_marineregions_v12.geojson': reference_root / 'malaysia_eez_marineregions_v12.geojson',
    }
    write_json(root / 'training_config.json', {**CONFIG, 'config_hash': config_hash})
    write_json(root / 'input_provenance.json', {'frozen_at_utc': now(), 'files': {label: {'sha256': sha(path), 'bytes': path.stat().st_size} for label, path in files.items()}, 'code_sha256': sha(__file__), 'config_hash': config_hash, 'python': os.sys.version, 'numpy': np.__version__, 'pandas': pd.__version__, 'sklearn': sklearn.__version__, 'name_override_manifest': {'file': '../backend/species_distribution/models/model_manifest.json', 'sha256': sha(NAME_OVERRIDE_PATH)} if NAME_OVERRIDE_PATH else None, 'frozen_candidate_species': len(all_candidates), 'requested_species': args.species or None})
    write_json(root / 'candidate_species.json', candidates)
    write_json(root / 'excluded_species.json', excluded)
    GRID.to_csv(root / 'reference/marine_grid.csv', index=False)
    shutil.copy2(reference_root / 'malaysia_eez_marineregions_v12.geojson', root / 'reference/malaysia_eez_marineregions_v12.geojson')
    print(json.dumps({'stage': 'configuration_frozen', 'candidate_species': len(candidates), 'kingdom_counts': dict(Counter(r['kingdom_name'] for r in candidates)), 'config_hash': config_hash, 'prepared_only': args.prepare_only}), flush=True)
    if args.prepare_only:
        return
    results = []
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers, initializer=worker_init, initargs=(str(reference_root),)) as pool:
        futures = [pool.submit(train_species, row, str(root), config_hash) for row in candidates]
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            results.append(result)
            progress = {'stage': 'training', 'completed': len(results), 'total': len(candidates), 'last_species': result['scientific_name'], 'last_status': result['status'], 'baseline_supported': sum(r['default_recommendation'] for r in results), 'elapsed_seconds': round(time.perf_counter() - started, 1), 'updated_at_utc': now()}
            write_json(root / 'progress.json', progress)
            print(json.dumps(progress), flush=True)
    results.sort(key=lambda r: r['scientific_name'])
    entries = [r['manifest_entry'] for r in results if r['status'] == 'trained']
    write_json(root / 'validation_results.json', [{k: v for k, v in r.items() if k != 'manifest_entry'} for r in results])
    manifest = {'schema_version': 4, 'model_version': CONFIG['model_version'], 'trained_at_utc': now(), 'package_complete': len(entries) == len(candidates), 'features': CONFIG['features'], 'grid_size_degrees': 0.1, 'training_grid_rows': len(GRID), 'background_mode': CONFIG['background_mode'], 'score_type': 'relative_occurrence', 'calibrated_probability': False, 'cross_species_ranking_validated': False, 'config_hash': config_hash, 'validation_method': CONFIG['split_method'], 'default_recommendation_rule': CONFIG['default_recommendation_rule'], 'species': entries}
    write_json(root / 'models/model_manifest.json', manifest)
    if entries:
        scores = np.column_stack([np.load(root / 'validation_predictions' / f"{entry['slug']}.npz")['final_grid_scores'] for entry in entries])
        np.savez_compressed(root / 'marine_grid_scores.npz', scores=scores, scientific_names=np.array([e['scientific_name'] for e in entries]), cell_ids=GRID.cell_id.to_numpy(dtype=str), latitude=GRID.latitude.to_numpy(), longitude=GRID.longitude.to_numpy())
    recommended = [e for e in entries if e['default_recommendation']]
    summary = {'completed_at_utc': now(), 'training_complete': len(entries) == len(candidates), 'subset_run': len(candidates) != len(all_candidates), 'requested_species': args.species or None, 'source_records': provenance['source_summary']['downloaded_records_all_taxa'], 'source_records_meaning': 'Original regional download before preprocessing, not independent training samples.', 'original_downloaded_taxa_audited': provenance['source_summary']['audited_taxa_all_downloaded'], 'resolved_species_audited': len(AUDIT), 'frozen_presence_cell_rows': len(PRESENCE), 'accepted_candidate_observations': provenance['source_summary']['accepted_observations_for_candidates'], 'marine_grid_rows': len(GRID), 'candidate_species': len(candidates), 'trained_models': len(entries), 'trained_animals': sum(e['kingdom_name'] == 'Animalia' for e in entries), 'trained_plants': sum(e['kingdom_name'] == 'Plantae' for e in entries), 'default_recommendation_species': len(recommended), 'default_recommendation_animals': sum(e['kingdom_name'] == 'Animalia' for e in recommended), 'default_recommendation_plants': sum(e['kingdom_name'] == 'Plantae' for e in recommended), 'weak_evidence_species': len(entries) - len(recommended), 'training_errors': [r for r in results if r['status'] != 'trained'], 'model_families': dict(Counter(e['selected_model'] for e in entries)), 'original_four': [r for r in results if r['scientific_name'] in ORIGINAL_FOUR], 'model_bytes': sum(e['model_file_bytes'] for e in entries), 'elapsed_seconds': round(time.perf_counter() - started, 2), 'caution': CONFIG['limits']}
    write_json(root / 'training_summary.json', summary)
    write_json(root / 'progress.json', {'stage': 'complete' if summary['training_complete'] else 'complete_with_errors', 'completed': len(results), 'total': len(candidates), 'updated_at_utc': now()})
    print(json.dumps({k: v for k, v in summary.items() if k not in ('original_four', 'training_errors')}, ensure_ascii=False), flush=True)
    if summary['training_errors']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
