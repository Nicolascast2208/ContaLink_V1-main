import firebase_admin
from firebase_admin import credentials
from google.cloud import firestore as google_firestore

cred_firebase = credentials.Certificate("credenciales_firebase.json")
firebase_admin.initialize_app(cred_firebase)
db = google_firestore.Client(credentials=cred_firebase.get_credential(), project="contalink-14cd6", database="bd-contalink")

collections = db.collections()
for col in collections:
    print(col.id)
    docs = col.limit(2).stream()
    for doc in docs:
        print(f"  {doc.id} -> {doc.to_dict()}")
