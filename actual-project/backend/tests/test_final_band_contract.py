from api_tests_core import api, signup, upload


def test_iteration2_scoring_metadata_is_band_native(api):
    _application, client = api

    body = client.get('/scoring-method/iteration2').get_json()

    assert body['quantityWeights'] == [
        {'quantity': 'Small', 'weight': 1},
        {'quantity': 'Medium', 'weight': 2},
        {'quantity': 'Large', 'weight': 3},
        {'quantity': 'Very Large', 'weight': 4},
    ]
    assert 'itemCountBands' not in body
    assert body['cleanupScore'] == 'quantity-band-unit-reduction'


def test_band_only_counted_report_remains_shareable(api):
    _application, client = api
    _session, headers = signup(client)
    photo = upload(client, headers)
    created = client.post('/reports', headers=headers, json={
        'beachId': 'morib',
        'photoKey': photo['photoKey'],
        'locationSource': 'manual',
        'quantities': {'Plastic': 'Medium', 'Glass': 'Large'},
    })
    assert created.status_code == 201
    report = created.get_json()
    assert report['status'] == 'Counted'
    assert not report.get('itemCounts')

    issued = client.get(f"/share-links?reportId={report['id']}", headers=headers)
    assert issued.status_code == 200
    token = issued.get_json()['token']

    shared = client.get(f'/share-links/{token}')
    assert shared.status_code == 200
    shared_report = shared.get_json()['report']
    assert shared_report['quantities'] == {'Plastic': 'Medium', 'Glass': 'Large'}
    assert shared_report['remainingQuantities'] == {'Plastic': 'Medium', 'Glass': 'Large'}
    assert 'itemCounts' not in shared_report
    assert 'remainingItemCounts' not in shared_report
    assert 'remainingTotal' not in shared_report

    photo_response = client.get(f'/share-links/{token}/photo')
    assert photo_response.status_code == 200
    assert photo_response.mimetype == 'image/jpeg'
