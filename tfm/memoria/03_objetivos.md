# Capítulo 3: Objetivos y Requisitos

## 3.1 Objetivo general

Diseñar e implementar una plataforma de cifrado de archivos web-first que cumpla con los estándares actuales de criptografía aplicada (NIST SP 800-38D, OWASP 2024) e integre un asistente inteligente local basado en RAG especializado en seguridad criptográfica.

## 3.2 Objetivos específicos

### OBJ-01: Cifrado conforme a estándares
Implementar cifrado AES-256-GCM con derivación de claves Argon2id, cumpliendo todos los parámetros mínimos de OWASP Password Storage Cheat Sheet 2024 y NIST SP 800-38D.

### OBJ-02: Arquitectura web-first
Desarrollar una interfaz web funcional accesible desde cualquier navegador moderno, con API REST documentada, que permita cifrar y descifrar archivos individuales y directorios.

### OBJ-03: Seguridad de la implementación
Eliminar las vulnerabilidades identificadas en el análisis inicial (path traversal, timing attack, salt fijo, deadlock mutex) mediante correcciones sistemáticas documentadas.

### OBJ-04: Asistente IA local
Implementar un asistente de chat especializado en criptografía aplicada que funcione completamente sin conexión a internet, usando RAG con una base de conocimiento estructurada sobre estándares NIST/OWASP/RFC.

### OBJ-05: Auditor de configuración
Implementar un sistema de auditoría automática de configuraciones criptográficas basado en reglas formalizadas, con puntuación de riesgo y recomendaciones de remediación referenciadas a estándares.

### OBJ-06: Multiplataforma
Proporcionar la funcionalidad central (cifrado/descifrado) en tres plataformas: web, Windows nativo (C++/Win32) y Android (Kotlin/Jetpack Compose).

## 3.3 Requisitos funcionales

### RF-01: Cifrado de archivos
- El sistema DEBE cifrar archivos individuales con AES-256-GCM
- El sistema DEBE soportar archivos de hasta 10 GB mediante streaming
- El sistema DEBE incluir el salt, IV y parámetros Argon2id en el archivo cifrado
- El sistema DEBE verificar el tag de autenticación antes de devolver datos descifrados

### RF-02: Gestión de contraseñas
- El sistema DEBE derivar la clave maestra usando Argon2id con parámetros OWASP mínimos
- El sistema DEBE almacenar solo el hash+salt de la contraseña, nunca la contraseña en texto claro
- El sistema DEBE soportar cambio de contraseña maestra con re-cifrado de la clave

### RF-03: Autenticación web
- El sistema DEBE usar tokens de sesión de 256-bit de entropía
- El sistema DEBE expirar sesiones inactivas tras 30 minutos
- El sistema DEBE requerir autenticación en todos los endpoints de cifrado/descifrado

### RF-04: Cifrado de directorios
- El sistema DEBE cifrar todos los archivos en un directorio de forma recursiva
- El sistema DEBE rechazar rutas que excedan el directorio base configurado (anti-path-traversal)

### RF-05: Asistente IA
- El sistema DEBE responder preguntas sobre criptografía en español
- El sistema DEBE citar estándares NIST/OWASP/RFC en sus respuestas
- El sistema DEBE funcionar sin conexión a internet (modo template fallback)
- El sistema DEBE limitar el historial de conversación a 10 mensajes

### RF-06: Auditor de configuración
- El sistema DEBE evaluar configuraciones JSON contra 9 reglas de seguridad
- El sistema DEBE calcular una puntuación de riesgo de 0 a 100
- El sistema DEBE identificar el nivel de riesgo: low/medium/high/critical

## 3.4 Requisitos no funcionales

### RNF-01: Rendimiento
- Throughput de cifrado: ≥ 100 MB/s para archivos grandes (con hardware AES-NI)
- Tiempo de derivación de claves Argon2id (65536 KB, t=3, p=2): ≤ 500ms en CPU moderna
- Latencia de respuesta AI (modo template): ≤ 100ms
- Latencia de respuesta AI (modo Ollama 7B): ≤ 30s (timeout configurado)

### RNF-02: Seguridad
- Cumplir OWASP ASVS 4.0 Nivel 2 para los controles aplicables
- Zero vulnerabilidades CVSS ≥ 7.0 no mitigadas en el análisis de seguridad
- Limpieza criptográfica de claves en memoria (fill(0)) antes de liberación

### RNF-03: Mantenibilidad
- Cobertura de tests unitarios ≥ 80% en módulos de criptografía y validación
- TypeScript estricto con `noImplicitAny` y `strictNullChecks`
- Arquitectura hexagonal con separación clara de dominio, aplicación e infraestructura

### RNF-04: Compatibilidad
- Navegadores: Chrome 90+, Firefox 88+, Edge 90+, Safari 14+
- Node.js: ≥ 18 LTS
- Windows: 10 / 11 (app nativa)
- Android: 8.0 Oreo+ (app nativa)

## 3.5 Casos de uso principales

```
UC-01: Cifrar archivo individual
  Actor: Usuario autenticado
  Flujo: Login → Upload archivo → Click Encrypt → Descarga .scrypt

UC-02: Descifrar archivo
  Actor: Usuario autenticado
  Flujo: Login → Upload .scrypt → Click Decrypt → Descarga original

UC-03: Auditar configuración criptográfica
  Actor: Desarrollador autenticado
  Flujo: Login → AI Advisor → Config Auditor → Pegar JSON → Audit → Ver hallazgos

UC-04: Consultar asistente IA
  Actor: Desarrollador/usuario autenticado
  Flujo: Login → AI Advisor → Chat → Escribir pregunta → Recibir respuesta con fuentes

UC-05: Cifrar directorio
  Actor: Usuario autenticado
  Flujo: Login → Directory Mode → Introducir ruta → Encrypt Directory → Ver progreso
```
