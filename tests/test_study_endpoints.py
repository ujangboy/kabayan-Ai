'''Test endpoint study (R7): /study/route, /metrics, /progress,
/daily-plan, /diagnostic, /knowledge-graph.

Fokus: kontrak respons (status 200 + kunci utama) baik dengan maupun
tanpa subject_id, serta endpoint yg menolak subject_id tak dikenal (404).
'''
import pytest
from fastapi.testclient import TestClient
from main import app
from database import get_db
import models


@pytest.fixture()
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def subject(db_session):
    s = models.Subject(name='Studi Uji')
    db_session.add(s)
    db_session.commit()
    db_session.refresh(s)
    return s


def test_metrics_global(client):
    res = client.get('/api/study/metrics')
    assert res.status_code == 200
    body = res.json()
    assert 'fsrs_overview' in body and 'speed' in body and 'fatigue' in body


def test_progress_global(client):
    res = client.get('/api/study/progress')
    assert res.status_code == 200
    body = res.json()
    assert 'streak' in body and 'mastery_trend' in body


def test_daily_plan_global(client):
    res = client.get('/api/study/daily-plan', params={'free_minutes': 90})
    assert res.status_code == 200
    body = res.json()
    assert 'items' in body and 'total_duration_minutes' in body and 'best_hour' in body


def test_diagnostic_global(client):
    res = client.get('/api/study/diagnostic')
    assert res.status_code == 200
    body = res.json()
    assert 'readiness' in body and 'overview' in body


def test_knowledge_graph_global(client):
    res = client.get('/api/study/knowledge-graph')
    assert res.status_code == 200
    body = res.json()
    assert 'nodes' in body and 'edges' in body and 'meta' in body


def test_route_requires_known_subject(client, subject):
    res = client.post('/api/study/route', json={'subject_id': subject.id})
    assert res.status_code == 200
    body = res.json()
    assert 'primary' in body and 'recommendations' in body


def test_route_unknown_subject_404(client):
    res = client.post('/api/study/route', json={'subject_id': 999999})
    assert res.status_code == 404


def test_metrics_scoped_by_subject(client, subject):
    res = client.get('/api/study/metrics', params={'subject_id': subject.id})
    assert res.status_code == 200
    assert res.json()['subject_id'] == subject.id


def test_metrics_unknown_subject_404(client):
    res = client.get('/api/study/metrics', params={'subject_id': 999999})
    assert res.status_code == 404
