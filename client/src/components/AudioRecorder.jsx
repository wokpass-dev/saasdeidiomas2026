import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';

export default function AudioRecorder({ onRecordingComplete, isProcessing }) {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    const startRecording = async () => {
        try {
            console.log("🎤 Iniciando acceso al micrófono...");

            if (Capacitor.isNativePlatform()) {
                const canRecord = await VoiceRecorder.canDeviceVoiceRecord();
                if (!canRecord.value) throw new Error("Dispositivo no soporta grabación nativa");

                let permissions = await VoiceRecorder.hasAudioRecordingPermission();
                if (!permissions.value) {
                    permissions = await VoiceRecorder.requestAudioRecordingPermission();
                }

                if (!permissions.value) throw new Error("Permiso denegado en dispositivo móvil");

                await VoiceRecorder.startRecording();
                setIsRecording(true);
                return;
            }

            // --- Rutina Clásica Web ---
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Tu navegador no soporta la grabación de audio o no estás en un entorno seguro (HTTPS).");
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("✅ Acceso al micrófono concedido.");

            // Detectar el formato soportado por el navegador
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/mp4',
                'audio/aac'
            ];

            let mimeType = '';
            for (const type of mimeTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    mimeType = type;
                    break;
                }
            }

            console.log(`🎤 Usando MIME Type: ${mimeType}`);
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                console.log(`🎤 Grabación finalizada: ${blob.size} bytes (${mimeType})`);
                onRecordingComplete(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("❌ Error accediendo al micrófono:", err);
            let userMessage = "No se pudo acceder al micrófono. ";
            if (err.name === 'NotAllowedError') userMessage += "Por favor, permite el acceso al micrófono en la configuración de tu navegador.";
            else if (err.name === 'NotFoundError') userMessage += "No se encontró ningún micrófono conectado.";
            else userMessage += err.message;
            alert(userMessage);
        }
    };

    const stopRecording = async () => {
        if (!isRecording) return;

        try {
            if (Capacitor.isNativePlatform()) {
                const result = await VoiceRecorder.stopRecording();
                setIsRecording(false);

                // Convert Base64 payload back to Blob to match existing pipeline
                const bytes = atob(result.value.recordDataBase64);
                let length = bytes.length;
                let outArray = new Uint8Array(length);

                while (length--) {
                    outArray[length] = bytes.charCodeAt(length);
                }

                const blob = new Blob([outArray], { type: result.value.mimeType || 'audio/aac' });
                console.log(`🎤 [Nativo] Grabación finalizada (Base64->Blob): ${blob.size} bytes`);
                onRecordingComplete(blob);
                return;
            }

            // --- Rutina Clásica Web ---
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
            }
        } catch (e) {
            console.error('Error parando grabación', e);
            setIsRecording(false);
        }
    };

    return (
        <div className="flex items-center justify-center">
            <button
                type="button" // Prevent form submit if inside form
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`
          flex items-center justify-center p-4 rounded-full transition-all duration-300
          ${isRecording
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'opacity-100'}
        `}
            >
                {isProcessing ? (
                    <Loader2 className="animate-spin text-white" size={24} />
                ) : isRecording ? (
                    <Square className="text-white fill-current" size={24} />
                ) : (
                    <Mic className="text-white" size={24} />
                )}
            </button>
            {isRecording && (
                <span className="ml-2 text-xs text-red-400 font-mono animate-pulse">
                    Grabando...
                </span>
            )}
        </div>
    );
}
