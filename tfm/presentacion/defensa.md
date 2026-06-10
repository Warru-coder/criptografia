# Guión de Defensa Oral — SecureCrypt TFM

**Duración estimada**: 20 minutos presentación + 10 minutos preguntas  
**Formato recomendado**: Diapositivas (Keynote/PowerPoint/Reveal.js)

---

## BLOQUE 1: Motivación y contexto (3 min)

### Diapositiva 1 — Portada
- Título, autor, director, fecha
- Logo/captura de la interfaz web

### Diapositiva 2 — El problema
**Punto clave**: La correcta implementación criptográfica sigue siendo un problema no resuelto

Datos de impacto:
- X% de aplicaciones reales usan AES-128-CBC o modos no autenticados (citar estudio)
- Los ataques a implementaciones criptográficas defectuosas representan X% de las brechas de datos
- Incluso desarrolladores con conocimientos teóricos cometen errores en la implementación

**Demostración visual**: Mostrar el código vulnerable original (salt fijo en C++, password en body) vs. código corregido

### Diapositiva 3 — Propuesta de valor
SecureCrypt resuelve tres problemas:
1. Herramienta de cifrado que implementa correctamente los estándares 2024
2. Asistente IA que guía la configuración segura sin dependencias cloud
3. Auditor automático que detecta configuraciones inseguras

---

## BLOQUE 2: Arquitectura (4 min)

### Diapositiva 4 — Stack tecnológico
Diagrama visual: Browser → Express → Domain (AES-GCM, Argon2id) + AI (RAG, Ollama)

**Justificar decisiones clave**:
- Web-first: máxima accesibilidad, cero instalación
- TypeScript estricto: eliminación de errores en tiempo de compilación
- Arquitectura hexagonal: domain independiente de framework

### Diapositiva 5 — Formato .scrypt
Diagrama de la cabecera del archivo:
```
[MAGIC][VER][PARAMS][SALT 32B][IV 12B][CIPHERTEXT][TAG 16B]
```

**Destacar**: El salt y los parámetros Argon2id van en la cabecera → self-documenting, sin necesidad de base de datos de configuración

### Diapositiva 6 — Flujo de autenticación web
Diagrama de secuencia: Login → Token → Bearer en todos los requests

**Contrastar con el sistema anterior**: password en cada request vs. token de sesión

---

## BLOQUE 3: Implementación criptográfica (4 min)

### Diapositiva 7 — AES-256-GCM con streaming
Diagrama del pipeline:
```
Input → cipher.update(chunks) → Output + authTag al final
```

**Punto crítico**: El authTag DEBE verificarse antes de devolver datos. Mostrar el código de decryptFile con try/catch en decipher.final()

### Diapositiva 8 — Argon2id: parámetros y justificación

Tabla comparativa:
| Parámetro | OWASP mínimo | SecureCrypt | Coste computacional |
|-----------|-------------|-------------|-------------------|
| memoryCost | 19.456 KB | 65.536 KB | 64 MB por intento |
| timeCost | 2 | 3 | ~300ms en i7 |
| parallelism | 1 | 2 | Usa 2 núcleos |

**Gráfico**: Comparativa GPU hashes/s: PBKDF2 vs. Argon2id → diferencia de 2000x

### Diapositiva 9 — Correcciones de seguridad (resumen)

Tabla con los 10 hallazgos, CVSS y estado:
- Mostrar especialmente SEC-001 (path traversal) y SEC-004 (salt fijo) como los más críticos
- Cada corrección referenciada a un estándar real

---

## BLOQUE 4: Sistema IA (4 min)

### Diapositiva 10 — Arquitectura RAG

Diagrama del pipeline:
```
Consulta → TF-IDF → Top-3 chunks → Contexto → Ollama → Respuesta
                                              ↓ sin Ollama
                                         Template answer
```

**Punto diferenciador**: 100% local, sin datos enviados a cloud, funciona offline

### Diapositiva 11 — Demostración en vivo

Si hay conexión y Ollama disponible:
1. Abrir la interfaz web
2. Hacer login
3. Mostrar Config Auditor: pegar configuración insegura → ver hallazgos
4. Mostrar Chat: preguntar "¿Qué parámetros Argon2id recomienda OWASP?"

### Diapositiva 12 — Resultados del auditor

Gráfico de precisión/recall del EXP-003:
- Mostrar los 9 tipos de vulnerabilidades y su tasa de detección
- Correlación entre puntuación automática y evaluación manual

---

## BLOQUE 5: Evaluación y conclusiones (5 min)

### Diapositiva 13 — Resultados experimentales

Tabla resumen de los 5 experimentos:
- Argon2id: [X]ms con parámetros OWASP mínimos, [Y]ms con parámetros SecureCrypt
- AES-GCM: [Z] MB/s con AES-NI
- Auditor: [N]% precisión, [M]% recall
- RAG: Precision@3=[P], Faithfulness=[F]%
- Penetration test: todos los vectores de Fase 0 bloqueados

### Diapositiva 14 — Objetivos cumplidos

Tabla de objetivos vs. estado:
- OBJ-01 a OBJ-05: CUMPLIDO
- OBJ-06: PARCIALMENTE CUMPLIDO (Windows funcional, Android pendiente)

### Diapositiva 15 — Trabajo futuro

Roadmap visual:
- Fase 2: FIDO2, cifrado asimétrico, Android, RAG semántico
- Fase 3: Extensión VS Code, API pública, macOS
- Fase 4: SaaS, post-cuántico (ML-KEM/Kyber)

### Diapositiva 16 — Conclusiones

**Tres takeaways**:
1. La criptografía correcta requiere implementación correcta, no solo teoría
2. RAG local elimina el trade-off entre IA útil y privacidad de datos
3. El análisis sistemático de vulnerabilidades (CVSS + PoC + corrección) es una metodología reproducible

---

## Preguntas frecuentes del tribunal

**P: ¿Por qué no usar bcrypt en lugar de Argon2id?**
R: Argon2id es memory-hard con control preciso de parámetros y ganó el Password Hashing Competition 2015. bcrypt tiene un límite de 72 bytes de contraseña y es menos eficiente en sus garantías de resistencia a GPU. OWASP 2024 recomienda Argon2id explícitamente.

**P: ¿Por qué TF-IDF y no embeddings vectoriales?**
R: TF-IDF es suficiente para un dominio tan específico con vocabulario controlado. Los embeddings añaden complejidad (modelo de 80MB adicional), latencia y requieren GPU para ser eficientes. El plan de trabajo futuro incluye embeddings para la siguiente fase.

**P: ¿Es seguro almacenar la clave maestra en memoria del servidor?**
R: Es el enfoque estándar en aplicaciones web de sesión. La alternativa (derivar la clave en cada request) requeriría la contraseña en cada request — el problema que precisamente solucionamos. La clave se limpia de memoria al hacer logout o expirar la sesión.

**P: ¿Cómo escala esto a múltiples usuarios?**
R: El SessionStore actual es in-memory y por usuario. Para escalar horizontalmente se usaría Redis con TTL. Cada usuario tiene su propia clave maestra y archivos cifrados independientes — no hay estado compartido.

**P: ¿Por qué Node.js y no Go o Rust para las operaciones criptográficas?**
R: Node.js crypto delega a OpenSSL, que usa aceleración AES-NI cuando está disponible. El throughput medido ([Z] MB/s) es comparable a implementaciones en Go o Rust para archivos de tamaño mediano. La ventaja es la integración nativa con el ecosistema web (Express, npm).
