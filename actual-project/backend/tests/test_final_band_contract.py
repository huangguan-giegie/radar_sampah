from api_tests_core import api


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
