# Sea-TACO Detection Model

This module contains the trained YOLO11m object detector prepared for the Radar Sampah project. It combines two litter datasets into one six-class bounding-box detection task:

- **SEA v44**: coastal and marine-litter images exported in YOLO format from Roboflow Universe.
- **TACO**: *Trash Annotations in Context*, whose COCO bounding boxes were converted and remapped to the shared classes.

The training images themselves are not committed to this repository. This keeps the Git history manageable and avoids redistributing third-party images. Download each dataset from its original source and review its licence before reuse.

## Model summary

| Item | Value |
|---|---|
| Architecture | YOLO11m object detection |
| Initial weights | `yolo11m.pt` |
| Input size | 640 px |
| Classes | 6 |
| Training limit | 100 epochs |
| Best epoch | 71 |
| Training stopped | Epoch 91, early stopping |
| Early-stopping patience | 20 epochs |
| Batch size | 8 |
| AMP | Enabled |
| Training seed | 20260827 |

The run was allowed up to 100 epochs. Validation performance peaked at epoch 71, and training stopped at epoch 91 after 20 epochs without a new best result. Use `models/sea_taco_yolo11m_best.pt`, not the final-epoch checkpoint.

## Validation results at the best epoch

| Metric | Score |
|---|---:|
| Precision | 0.7995 |
| Recall | 0.7638 |
| mAP@0.50 | 0.7894 |
| mAP@0.50:0.95 | 0.6040 |

Class-level mAP@0.50 from the precision-recall plot:

| Class | mAP@0.50 |
|---|---:|
| plastic | 0.865 |
| metal | 0.918 |
| glass | 0.873 |
| paper_cardboard | 0.401 |
| styrofoam | 0.836 |
| fishing_gear | 0.843 |

`paper_cardboard` is the weakest class because it has substantially fewer examples than the other classes. The current metrics were measured on the combined validation split, which is dominated by SEA images; they should not be treated as guaranteed performance on arbitrary phone photographs.

## Dataset composition

| Split | Images | Bounding boxes |
|---|---:|---:|
| Train | 7,272 | 32,738 |
| Validation | 1,885 | 9,001 |
| Test | 1,017 | 4,629 |
| **Total** | **10,174** | **46,368** |

The unified classes are:

```text
0 plastic
1 metal
2 glass
3 paper_cardboard
4 styrofoam
5 fishing_gear
```

SEA's original 11 categories were consolidated into these classes. TACO's COCO categories were mapped to the same taxonomy; out-of-scope categories such as cigarette, food waste, shoe and unlabeled litter were omitted. The exact mapping and class counts are preserved in `artifacts/dataset_build_report.json`.

## Repository contents

```text
ml-model/
├── models/
│   └── sea_taco_yolo11m_best.pt
├── artifacts/
│   ├── results.csv
│   ├── results.png
│   ├── BoxPR_curve.png
│   ├── confusion_matrix.png
│   ├── confusion_matrix_normalized.png
│   └── dataset_build_report.json
├── config/
│   └── training.yaml
├── scripts/
│   ├── build_sea_taco_6class.py
│   ├── download_official_taco.py
│   ├── parallel_download.py
│   └── validate_yolo_dataset.py
├── predict.py
├── train.py
└── requirements.txt
```

The weight file is stored with Git LFS. After cloning this branch, retrieve it with:

```powershell
git lfs install
git lfs pull
```

The expected SHA-256 checksum is:

```text
e6dcf0f27a78c515851b6505e45d9f70cd2710f8917bf50f763e1cf50c78fb12
```

## Environment

From this directory:

```powershell
python -m venv .venv
& .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run inference

```powershell
python predict.py --source "path\to\image.jpg"
```

Results are written to `runs/predict/`. Confidence and IoU thresholds can be changed with `--conf` and `--iou`.

## Rebuild and train

Place the downloaded SEA export and official TACO data outside Git, then build the combined dataset:

```powershell
python scripts/build_sea_taco_6class.py `
  --sea "path\to\sea-v44-yolo11" `
  --taco-annotations "path\to\TACO\data\annotations.json" `
  --output "datasets\sea-taco-6class"
```

Validate it before training:

```powershell
python scripts/validate_yolo_dataset.py --root "datasets\sea-taco-6class" --classes 6
```

Then reproduce the training configuration:

```powershell
python train.py --data "datasets\sea-taco-6class\data.yaml"
```

The original run used an NVIDIA GPU (`device=0`). Change `--device` when running on CPU or another accelerator.

## Deployment note

This branch supplies the detector weights and inference entry point. It does not yet replace the backend's existing demonstration recognition adapter. Production integration should load the model once at backend startup, accept an uploaded image, run local inference, and return class, confidence and bounding-box coordinates to the frontend.

## Sources and attribution

- SEA v44: <https://universe.roboflow.com/hongmo/sea-ezx3q/dataset/44> (the downloaded export identifies its licence as CC BY 4.0).
- TACO repository: <https://github.com/pedropro/TACO>
- TACO paper: Pedro F. Proenca and Pedro Simoes, *TACO: Trash Annotations in Context for Litter Detection*, 2020, <https://arxiv.org/abs/2003.06975>.

The trained weights are intended for the Radar Sampah student project. Validate accuracy, privacy handling and third-party licensing before public production deployment.
