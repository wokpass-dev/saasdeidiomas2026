# 📱 FASE 4: Estrategia de Aplicación Móvil Nativa (SaaS)

Pivotando desde WhatsApp hacia un entorno 100% controlado, este documento establece el flujo de conversión del frontend web (React) hacia aplicaciones nativas para iOS y Android, asegurando distribución en tiendas (App Store / Google Play).

## 🛠️ Arquitectura Elegida: Capacitor.js + React (Web-to-Native)

Optamos por **Capacitor** porque permite compilar el código actual de React Web directamente en binarios nativos (APK para Android, IPA para iOS) sin tener que reescribir la app en React Native ni Swift/Kotlin.

### Beneficios Inmediatos
1. **Un solo código base:** Continúas programando en React para Web, iOS y Android al mismo tiempo.
2. **Acceso Nativo:** Acceso a APIs de dispositivo bajo demanda (Micrófono nativo sin latencias web, Almacenamiento, Vibración).
3. **Notificaciones Push:** Sustituyen a WhatsApp como herramienta maestra de retención (FCM -> Apple Push/Google Push).

---

## 🏃‍♂️ Hoja de Ruta de Ejecución (Semanas 8 y 9)

### 1. Inicialización del Entorno Móvil
- Instalar Capacitor en la raíz del frontend (`npm install @capacitor/core @capacitor/cli`).
- Inicializar la estructura (`npx cap init SpeakGo com.puentesglobales.speakgo`).
- Añadir plataformas nativas:
  - `npm install @capacitor/android @capacitor/ios`
  - `npx cap add android`
  - `npx cap add ios`

### 2. Optimización Web -> Móvil
- Ajuste de **CORS** en `server/index.js` para aceptar peticiones desde `capacitor://localhost` y esquemas de app nativa.
- Adaptar las variables de entorno (`.env`) en el cliente móvil para que apunten a la IP pública o dominio en Render (`https://tu-api.onrender.com`), abandonando los "localhost" de pruebas.
- Ajuste del micrófono (`AudioRecorder.jsx`). Asegurar compatibilidad con el sistema de grabación de Capacitor si la API Web estándar `MediaRecorder` sufre permisos rotos en WebView iOS.

### 3. Factor de Retención: Notificaciones Push
- Instalar plugin oficial: `npm install @capacitor/push-notifications`.
- Conectar Firebase Cloud Messaging (FCM).
- Modificar el *Proactive Engine* en el backend: En lugar de buscar WhatsApp (saas_chats), debe enviar payloads FCM hacia los dispositivos que pasaron más de 24hs inactivos.

### 4. Deploy y Monetización Mobile
- Modificar Stripe en la app móvil. Apple y Google *exigen* usar sus pasarelas nativas (In-App Purchases) para apps digitales dentro de sus tiendas.
- **Solución B2B (Evasiva Segura):** El modelo SaaS permite a los clientes comprar la licencia (Stripe) *por la web* y simplemente "hacer login" en la App. Si quieres vender suscripciones *dentro* de las stores, se requerirá integrar RevenueCat para sincronizar IAP de Apple/Google con tu bandera de `is_premium` en Supabase.

---

## 🚀 Próximo Paso Accionable
Dile al equipo/IA si quieres que comience instalando Capacitor y creando el arnés nativo de Android/iOS en `client`, o si adaptamos `AudioRecorder.jsx` primero para la futura PWA/Móvil.
