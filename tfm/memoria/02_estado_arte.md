# Capítulo 2: Estado del Arte

## 2.1 Cifrado simétrico de archivos

### 2.1.1 AES (Advanced Encryption Standard)

El Estándar de Cifrado Avanzado (AES), adoptado por NIST en 2001 [FIPS 197], es el algoritmo de cifrado simétrico más ampliamente utilizado. Soporta longitudes de clave de 128, 192 y 256 bits.

**Modos de operación relevantes:**

| Modo | Autenticación | IV requerido | Recomendado |
|------|--------------|-------------|-------------|
| ECB | No | No | **No** (patrones visibles) |
| CBC | No (separado) | Sí | **No** (padding oracle) |
| CTR | No | Sí | Parcialmente |
| GCM | Sí (AEAD) | Sí (96 bits) | **Sí** (NIST SP 800-38D) |
| CCM | Sí (AEAD) | Sí | Sí (IoT) |

**AES-256-GCM** es el modo recomendado por NIST SP 800-38D para cifrado autenticado. Proporciona confidencialidad + integridad + autenticidad en una sola pasada, con un tag de autenticación de 128 bits que detecta cualquier modificación del texto cifrado.

**Consideraciones de implementación críticas:**
- La reutilización de nonces en GCM compromete completamente la seguridad [NIST SP 800-38D, §8]
- El tag de autenticación DEBE verificarse antes de procesar el texto plano
- Para archivos grandes, se requiere streaming con verificación del tag al final

### 2.1.2 ChaCha20-Poly1305

Alternativa a AES-GCM para sistemas sin aceleración hardware AES (AES-NI). Definido en RFC 8439. Utilizado en TLS 1.3 como suite de cifrado alternativa. SecureCrypt lo considera para una versión futura.

## 2.2 Funciones de Derivación de Claves (KDF)

### 2.2.1 Historia y evolución

La derivación de claves desde contraseñas ha evolucionado significativamente:

- **MD5/SHA-1 directo** (años 90): sin coste computacional, vulnerable a tablas rainbow
- **PBKDF2** (2000, RFC 2898): añade iteraciones, pero paralelizable en GPU
- **bcrypt** (1999): memory-hard parcialmente, limitado a 72 bytes de contraseña
- **scrypt** (2009): memory-hard, usado en criptomonedas
- **Argon2** (2015): ganador del Password Hashing Competition, tres variantes

### 2.2.2 Argon2id — Estado actual

Argon2id (RFC 9106, 2021) combina los modelos de Argon2i (resistencia a ataques de canal lateral) y Argon2d (resistencia máxima a GPU), siendo el KDF recomendado por OWASP Password Storage Cheat Sheet 2024.

**Parámetros OWASP 2024:**

| Parámetro | Mínimo OWASP | Recomendado SecureCrypt | Descripción |
|-----------|-------------|------------------------|-------------|
| memoryCost | 19.456 KB | 65.536 KB | Memoria usada por iteración |
| timeCost | 2 | 3 | Número de pasadas |
| parallelism | 1 | 2 | Hilos paralelos |
| saltLength | 16 bytes | 32 bytes | Longitud del salt |
| keyLength | 32 bytes | 32 bytes | Salida (256 bits para AES-256) |

**Coste computacional con parámetros SecureCrypt:** ~150–300ms en hardware moderno (Intel i7 / AMD Ryzen 5). Este rango cumple la recomendación OWASP de 1-2 segundos para autenticación interactiva con margen de seguridad.

### 2.2.3 PBKDF2 — Casos de uso legacy

PBKDF2-HMAC-SHA256 con ≥600.000 iteraciones (OWASP 2024) sigue siendo aceptable como alternativa cuando Argon2id no está disponible. SecureCrypt detecta configuraciones PBKDF2 con menos de 600.000 iteraciones como `critical`.

## 2.3 Herramientas de cifrado de archivos existentes

### 2.3.1 VeraCrypt

- **Tipo**: Cifrado de disco/volumen
- **Algoritmos**: AES, Twofish, Serpent, XTS mode
- **KDF**: PBKDF2 con algoritmos múltiples
- **Limitaciones**: No tiene API REST, no integra IA, no es web-native

### 2.3.2 age (Actually Good Encryption)

- **Tipo**: Cifrado de archivos individuales
- **Algoritmos**: X25519, ChaCha20-Poly1305
- **Enfoque**: Simplicidad y criptografía moderna
- **Limitaciones**: No soporta cifrado simétrico basado en contraseña por diseño

### 2.3.3 OpenSSL enc

- **Tipo**: Herramienta CLI
- **Limitaciones**: Usa PBKDF2 con iteraciones bajas por defecto, requiere conocimiento experto, sin interfaz web

### 2.3.4 Análisis comparativo

| Característica | VeraCrypt | age | OpenSSL | **SecureCrypt** |
|----------------|----------|-----|---------|-----------------|
| Interfaz web | No | No | No | **Sí** |
| API REST | No | No | No | **Sí** |
| Asistente IA | No | No | No | **Sí** |
| Auditor config | No | No | No | **Sí** |
| Argon2id | No | N/A | No | **Sí** |
| Código abierto | Sí | Sí | Sí | **Sí** |
| Multiplataforma | Sí | Sí | Sí | Sí |

## 2.4 Inteligencia Artificial para Seguridad

### 2.4.1 LLM y ciberseguridad

El uso de modelos de lenguaje grande (LLM) en ciberseguridad ha crecido exponencialmente desde 2022. Aplicaciones actuales incluyen:

- Análisis de código para detección de vulnerabilidades (GitHub Copilot, CodeQL)
- Generación de exploits para pentesting (GPT-4 + Metasploit)
- Asistentes especializados en seguridad (SecurityGPT, Falcon)
- Análisis de logs y detección de anomalías

### 2.4.2 RAG (Retrieval Augmented Generation)

RAG [Lewis et al., 2020] combina recuperación de documentos con generación de texto para reducir alucinaciones y mantener el conocimiento actualizable sin re-entrenar el modelo. Arquitectura:

```
Consulta → Codificación → Búsqueda semántica → Recuperación de chunks
         → Construcción de contexto → Generación LLM → Respuesta fundamentada
```

**Métricas de calidad RAG:**
- **Faithfulness**: ¿La respuesta está fundamentada en los documentos recuperados?
- **Answer Relevancy**: ¿La respuesta responde la pregunta?
- **Context Precision**: ¿Los documentos recuperados son relevantes?
- **Context Recall**: ¿Se recuperaron todos los documentos necesarios?

### 2.4.3 LLM locales (Ollama)

Ollama permite ejecutar modelos LLM localmente, eliminando dependencias de APIs cloud. Ventajas para SecureCrypt:

- **Privacidad**: Las consultas sobre configuraciones criptográficas sensibles no salen del sistema
- **Sin latencia de red**: Respuestas más rápidas para usuarios locales
- **Sin coste por token**: Escalable sin límites de uso
- **Offline**: Funciona sin conexión a internet

**Modelo utilizado**: `qwen2.5-coder:7b-instruct-q4_K_M` — optimizado para código y documentación técnica, con buen rendimiento en criptografía aplicada.

## 2.5 Estándares y marcos de referencia

| Estándar | Organismo | Relevancia |
|----------|----------|-----------|
| FIPS 197 | NIST | AES |
| NIST SP 800-38D | NIST | AES-GCM |
| NIST SP 800-57 | NIST | Gestión de claves |
| NIST SP 800-132 | NIST | Derivación de claves basada en contraseña |
| RFC 9106 | IETF | Argon2 |
| RFC 8018 | IETF | PBKDF2 |
| OWASP ASVS 4.0 | OWASP | Verificación de seguridad de aplicaciones |
| OWASP Password Storage CS | OWASP | Almacenamiento seguro de contraseñas |
| GDPR Art. 32 | UE | Medidas técnicas de seguridad |
