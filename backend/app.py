import json
import os
import threading
import urllib.error
import urllib.request
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
lock = threading.RLock()
state = {"next_number": 1, "queue": [], "desks": [
    {"id": n, "status": "disponible", "ticket": None, "last_ticket": None}
    for n in range(1, 5)
]}

KV_URL = os.getenv("KV_REST_API_URL", "").rstrip("/")
KV_TOKEN = os.getenv("KV_REST_API_TOKEN", "")


def kv_command(*parts):
    body = json.dumps(list(parts)).encode()
    req = urllib.request.Request(f"{KV_URL}/", data=body, headers={
        "Authorization": f"Bearer {KV_TOKEN}", "Content-Type": "application/json"
    })
    with urllib.request.urlopen(req, timeout=4) as response:
        return json.loads(response.read().decode()).get("result")


def read_state():
    if KV_URL and KV_TOKEN:
        raw = kv_command("GET", "turnos:estado")
        if raw:
            return json.loads(raw)
    return state


def write_state(data):
    global state
    state = data
    if KV_URL and KV_TOKEN:
        kv_command("SET", "turnos:estado", json.dumps(data, ensure_ascii=False))


def snapshot():
    with lock:
        return read_state()


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "storage": "redis" if KV_URL and KV_TOKEN else "memory"})


@app.get("/api/state")
def get_state():
    return jsonify(snapshot())


@app.post("/api/tickets")
def create_ticket():
    with lock:
        data = snapshot()
        number = data["next_number"]
        data["next_number"] += 1
        ticket = {"id": f"A{number:02d}", "created_at": datetime.now(timezone.utc).isoformat(), "status": "esperando"}
        data["queue"].append(ticket)
        write_state(data)
        return jsonify({"ticket": ticket, "state": data}), 201


@app.post("/api/desks/<int:desk_id>/call")
def call_ticket(desk_id):
    with lock:
        data = snapshot()
        desk = next((item for item in data["desks"] if item["id"] == desk_id), None)
        if desk is None:
            return jsonify({"error": "Ventanilla no encontrada"}), 404
        if desk["status"] == "ocupada":
            return jsonify({"error": "La ventanilla está ocupada"}), 409
        ticket = next((item for item in data["queue"] if item["status"] == "esperando"), None)
        if ticket is None:
            return jsonify({"error": "No hay turnos en espera"}), 409
        ticket["status"] = "atendiendo"
        ticket["desk"] = desk_id
        desk.update(status="ocupada", ticket=ticket["id"], last_ticket=ticket["id"])
        write_state(data)
        return jsonify({"ticket": ticket, "state": data})


@app.post("/api/desks/<int:desk_id>/release")
def release_desk(desk_id):
    with lock:
        data = snapshot()
        desk = next((item for item in data["desks"] if item["id"] == desk_id), None)
        if desk is None:
            return jsonify({"error": "Ventanilla no encontrada"}), 404
        if desk["ticket"]:
            for ticket in data["queue"]:
                if ticket["id"] == desk["ticket"]:
                    ticket["status"] = "atendido"
                    break
        desk.update(status="disponible", ticket=None)
        write_state(data)
        return jsonify({"state": data})


@app.post("/api/reset")
def reset():
    global state
    with lock:
        state = {"next_number": 1, "queue": [], "desks": [
            {"id": n, "status": "disponible", "ticket": None, "last_ticket": None}
            for n in range(1, 5)
        ]}
        write_state(state)
        return jsonify(state)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)

