import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getAuth, Auth } from 'firebase/auth';
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBVCHfbuKeEgIo2vvzykLG_0bI3EShBvhk",
  authDomain: "contalink-14cd6.firebaseapp.com",
  projectId: "contalink-14cd6",
  storageBucket: "contalink-14cd6.firebasestorage.app",
  messagingSenderId: "807808449081",
  appId: "1:807808449081:web:1ed199b57e25e0cc442be8"
};

// Inicializamos la App
const app = initializeApp(firebaseConfig);

// Inicializamos Auth con persistencia
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch (e) {
  auth = getAuth(app);
}

// Inicializamos Servicios
const storage = getStorage(app);
const db = getFirestore(app, "bd-contalink");

// Exportamos para usar en las pantallas
export { auth, db, storage };