# Lanzamiento al Mercado: SpeakGo Mobile App (Android/iOS)

Este documento detalla los pasos finales comprobados para tomar el código híbrido ya finalizado de SpeakGo (construido en React + Capacitor) y enviarlo satisfactoriamente a las tiendas de aplicaciones oficiales de Google Play Store y Apple App Store.

## Fase A: Compilar Binarios desde tu Máquina

### 🤖 Específico para ANDROID (Google Play)

**Requisito previo:** Debes tener instalado *Android Studio* en tu PC.

1. **Sincronización:** Abre la consola de tu computadora (`cmd` o `PowerShell`), ve a la carpeta `/client` asegurándote de que los archivos estén actualizados (`npm run build`). Luego inyecta el código en Android:
   ```bash
   npx cap sync android
   ```
2. **Abre Android Studio:**
   ```bash
   npx cap open android
   ```
3. **Firmar y Construir el `.AAB` (App Bundle)**:
   - Dentro de Android Studio, espera a que termine de cargar el gradle (abajo a la derecha cargará una barra azul).
   - Ve arriba al menú en **Build > Generate Signed Bundle / APK...**.
   - Selecciona **Android App Bundle** (obligatorio para Google Play desde 2021).
   - Haz clic en *Create New* bajo el "Key store path" (Guarda muy bien este archivo `.jks` en un lugar seguro junto a sus 2 contraseñas).
   - Termina el Asistente y dale a "Finish". 
   - 🎉 Te generará un archivo `.aab` (generalmente en la ruta `client/android/app/release/app-release.aab`).

---

### 🍏 Específico para iOS (Apple App Store)

**Requisito previo:** Obligatorio tener una **Computadora Mac (macOS)** con *Xcode* instalado y pagar la licencia $99 USD/año "Apple Developer".

1. **Sincronización:** Abre terminal dentro de `/client`, y asegúrate de actualizar Xcode con tu React:
   ```bash
   npx cap sync ios
   ```
2. **Abre Xcode:**
   ```bash
   npx cap open ios
   ```
3. **Configuraciones de App Store:**
   - En la parte izquierda de Xcode, toca en "App".
   - En la pestaña superior, entra a **"Signing & Capabilities"**.
   - Ingresa en "Team" tu cuenta de Apple ID Developer (si no aparece, dale a *Add an Account*). 
   - El *Bundle Identifier* debe ser exácto a lo que armamos en Capacitor (usualmente `com.puentesglobales.speakgo`).
4. **Construir (Archive)**:
   - Arriba en la pestaña **Product**, primero en "Destination" selecciona **"Any iOS Device (arm64)"**.
   - Luego clickea en **Product > Archive**. (Va a demorar varios minutos).
   - 🍏 Se abrirá una ventana. Dale a **Distribute App > App Store Connect > Upload**.

---

## Fase B: Configurar Google STT / API Keys
La app enviará requests Web al servidor de Render usando `client/src/services/api.js`.
Por ende las APIs de terceros (Gemini, Supabase Keys) **no están expuestas ni hackeables** en el celular, todo vive seguro en tu servidor de Node.js en Render.

### Activando el Micrófono (Capacitor Voice Recorder)
Ya inyectamos validaciones `await VoiceRecorder.requestAudioRecordingPermission()`. Lo que significa que **cuando la App iOS/Android inicie, Apple y Google notaran esto y exigirán** que justifiques en las Tiendas para qué quieres grabar Voz de fondo.
1. En **Android Studio:** Esto ya lo preapantalló Capacitor por nosotros en `AndroidManifest.xml`. Está cubierto.
2. En **Xcode (iOS)**: Ya dejamos listo dentro del `Info.plist` de Xcode un texto por defecto que dice `"Por favor concédenos micrófono para aprender"`. Si Apple te llega a rechazar el App, asegurate de ser más descriptivo en Xcode editando el archivo `Info.plist -> NSMicrophoneUsageDescription`.

---

## Fase C: Activando Firebase Cloud Messaging (El As bajo la Manga)

Para habilitar que tu Push Proactivo le despierte las pantallas, necesitas unir *tu cuenta real* de Firebase Platform con la app:

1. Ingresa a la consola de [Firebase de Google](https://console.firebase.google.com/).
2. Crea un proyecto (llámalo "SpeakGo").
3. Registra ahí adentro tu **Android** y tu **iOS** app (poniéndole el id `com.puentesglobales.speakgo`).
4. **Para Android:** Firebase te botará un archivo llamado `google-services.json`. Ponlo en la raiz de `client/android/app/`
5. **Para iOS:** Firebase te botará `GoogleService-Info.plist`. Arrástralo gráficamente *hasta adentro de Xcode* en el árbol de carpetas izquierdo (muy importante arrastrarlo desde la mac).
6. Entra de nuevo al Dashboard de Firebase, ve a Settings de API v1, y extrae tu Server Key (`FIREBASE_SERVER_KEY`). **Colócala dentro del panel Variables de Entorno de RENDER en tu Backend**. Con eso Node.js podrá disparar las alarmas silenciosas cada 6 horas y FCM se encargará de hacer sonar los teléfonos!.

---
¡Listo Comandante! Sube tu .AAB a Play Console y tu Archive a AppStore Connect, llena los logos, políticas de pantallazos y en 48hs hábiles (lo que tarda la revisión humana), tu StartUp SaaS estará Live en todas las Stores globales. 🚀
