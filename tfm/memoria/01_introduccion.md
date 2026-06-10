# Capítulo 1: Introducción

## 1.1 Motivación

La protección de datos personales y corporativos representa uno de los desafíos más críticos de la era digital. El volumen de datos sensibles almacenados y transmitidos digitalmente crece de forma exponencial, mientras que las amenazas criptográficas evolucionan con igual rapidez: ataques de fuerza bruta acelerados por GPUs modernas, compromisos de claves por implementaciones defectuosas y el horizonte de la computación cuántica que amenaza los esquemas de clave pública actuales.

A pesar de que los estándares criptográficos actuales (AES-256-GCM, Argon2id) ofrecen una seguridad robusta, su adopción correcta sigue siendo un problema no resuelto. Estudios recientes muestran que una proporción significativa de aplicaciones reales aún usa AES-128-CBC, PBKDF2 con iteraciones insuficientes o almacena contraseñas con MD5/SHA-1. La causa no es desconocimiento teórico, sino la dificultad de traducir los estándares NIST/OWASP a código correcto.

Este proyecto surge de la necesidad de:

1. Una herramienta de cifrado que implemente correctamente los estándares actuales
2. Un asistente inteligente que ayude a los desarrolladores a configurar sus sistemas criptográficos de forma segura
3. Un auditor automático que detecte configuraciones inseguras antes de que lleguen a producción

## 1.2 Contexto académico

Este TFM se enmarca en el contexto del Máster en Ciberseguridad y Computación, integrando conocimientos de:

- **Criptografía aplicada**: AES-GCM, Argon2id, HMAC, gestión de claves
- **Seguridad de software**: OWASP Top 10, modelado de amenazas, análisis de vulnerabilidades
- **Inteligencia artificial**: RAG, NLP, modelos de lenguaje, recuperación de información
- **Ingeniería de software**: arquitectura hexagonal, TDD, clean architecture

## 1.3 Alcance del proyecto

### 1.3.1 Componentes implementados

| Componente | Tecnología | Estado |
|------------|-----------|--------|
| Web backend | Node.js + Express + TypeScript | Completo |
| Cifrado AES-256-GCM | Node.js crypto (streaming) | Completo |
| KDF Argon2id | argon2 npm package | Completo |
| Gestión de sesiones | In-memory store, 256-bit tokens | Completo |
| Protección path traversal | Sandbox validation | Completo |
| Base de conocimiento RAG | 15 chunks NIST/OWASP | Completo |
| Asistente IA (chat) | Ollama + qwen2.5-coder | Completo |
| Auditor de configuración | 9 reglas NIST/OWASP | Completo |
| App Windows nativa | C++/Win32 | Parcial |
| App Android nativa | Kotlin/Jetpack Compose | Planificado |

### 1.3.2 Fuera de alcance

- Cifrado asimétrico (RSA, ECC) — se mantiene en la hoja de ruta
- Sincronización en la nube — versión SaaS planificada para v2
- Autenticación multifactor — planificada en Fase 2
- Soporte macOS/Linux nativo — en la hoja de ruta

## 1.4 Estructura de la memoria

- **Capítulo 2**: Estado del arte en cifrado de archivos, KDFs y asistentes IA para seguridad
- **Capítulo 3**: Objetivos y requisitos del sistema
- **Capítulo 4**: Arquitectura del sistema
- **Capítulo 5**: Implementación de los componentes de cifrado
- **Capítulo 6**: Integración del asistente IA con RAG
- **Capítulo 7**: Análisis de seguridad y vulnerabilidades encontradas
- **Capítulo 8**: Evaluación experimental y benchmarks
- **Capítulo 9**: Conclusiones y trabajo futuro
- **Capítulo 10**: Bibliografía

## 1.5 Contribuciones originales

1. **Auditor criptográfico basado en reglas**: Formalización de 9 reglas de seguridad NIST/OWASP como sistema de detección automática de configuraciones inseguras, con puntuación de riesgo ponderada.

2. **RAG especializado en criptografía sin dependencias cloud**: Sistema de recuperación aumentada por generación con base de conocimiento estructurada sobre estándares criptográficos, ejecutado completamente en local.

3. **Análisis sistemático de vulnerabilidades en implementaciones reales**: Identificación y corrección de 10 vulnerabilidades de seguridad en una implementación real, documentadas con CVSS, PoC y remediación.

4. **Formato de archivo .scrypt**: Especificación de un formato de archivo cifrado con cabecera autenticada que incluye sal, IV, parámetros Argon2id y tag de autenticación.
