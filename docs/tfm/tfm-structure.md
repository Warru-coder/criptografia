# Estructura Académica del TFM — SecureCrypt

> Guía completa para la memoria del Trabajo Fin de Máster

---

## Título Propuesto
**"SecureCrypt: Diseño e Implementación de una Suite de Cifrado Multiplataforma con Integración de Inteligencia Artificial para Auditoría de Seguridad Criptográfica"**

Alternativas:
- "Cifrado de Archivos Asistido por IA: Arquitectura, Implementación y Evaluación de SecureCrypt"
- "Integración de LLMs Locales en Herramientas de Ciberseguridad: El Caso de SecureCrypt"

---

## Estructura de la Memoria (80-100 páginas)

### Capítulo 1 — Introducción (5-8 páginas)
**Contenido**:
- Contexto y motivación: el problema de la gestión de archivos confidenciales en las organizaciones
- Estadísticas actuales: coste medio de una brecha de seguridad (IBM Cost of Data Breach Report 2024: 4,45M USD), porcentaje de PYMEs sin políticas de cifrado
- Objetivos generales y específicos
- Alcance y limitaciones del proyecto
- Estructura de la memoria

**Capturas necesarias**:
- Captura de una brecha de datos real (HaveIBeenPwned estadísticas)
- Interfaz inicial de SecureCrypt mostrando el problema que resuelve

---

### Capítulo 2 — Estado del Arte (12-15 páginas)
**Contenido**:
- **2.1 Criptografía de clave simétrica**: AES, modos de operación (ECB, CBC, GCM), por qué GCM
- **2.2 Key Derivation Functions**: PBKDF2, bcrypt, scrypt, Argon2id — comparativa de seguridad
- **2.3 Herramientas existentes**: VeraCrypt (análisis técnico), Cryptomator, 7-Zip, GPG
- **2.4 IA en ciberseguridad**: LLMs para análisis de código, detección de vulnerabilidades, asistentes de seguridad
- **2.5 RAG (Retrieval Augmented Generation)**: arquitectura, casos de uso en seguridad
- **2.6 Análisis comparativo**: tabla de características SecureCrypt vs. competidores

**Diagramas necesarios**:
- Diagrama comparativo de modos AES (ECB vs. GCM visualmente)
- Benchmark de tiempo de cracking para distintos KDF
- Tabla comparativa de herramientas (VeraCrypt, Cryptomator, GPG, SecureCrypt)

**Capturas necesarias**:
- VeraCrypt en funcionamiento (captura pantalla)
- Cryptomator UI

---

### Capítulo 3 — Análisis de Requisitos (8-10 páginas)
**Contenido**:
- **3.1 Identificación de stakeholders**: usuario final, administrador IT, auditor de seguridad, desarrollador
- **3.2 Requisitos funcionales**: cifrado/descifrado, gestión de vault, integración IA, API REST, multiples plataformas
- **3.3 Requisitos no funcionales**: rendimiento (archivos > 1GB), seguridad (OWASP compliance), usabilidad, portabilidad
- **3.4 Casos de uso principales**: diagramas UML

**Diagramas necesarios**:
- Diagrama de casos de uso (UML)
- Diagrama de actores y sus interacciones
- Matriz de trazabilidad Requisitos → Implementación

---

### Capítulo 4 — Diseño del Sistema (15-20 páginas)
**Contenido**:
- **4.1 Decisiones arquitectónicas**: por qué Clean Architecture + Hexagonal, ADRs
- **4.2 Arquitectura de capas**: diagrama de capas con responsabilidades
- **4.3 Bounded Contexts (DDD)**: Crypto, Vault, Identity, AI, Audit
- **4.4 Diseño de la capa criptográfica**: flujo completo, formato del archivo .scrypt
- **4.5 Diseño del módulo de IA**: arquitectura RAG, flujo de embedding, integración con Ollama
- **4.6 Diseño de la API REST**: endpoints, autenticación por sesión, schema de request/response
- **4.7 Modelo de datos**: entidades y relaciones (SQLite)
- **4.8 Seguridad by design**: principios OWASP aplicados

**Diagramas necesarios**:
- Diagrama de arquitectura general (draw.io)
- Diagrama de clases principales (UML)
- Diagrama de secuencia: cifrado de archivo (UML)
- Diagrama de secuencia: autenticación + sesión
- Diagrama de arquitectura RAG
- Formato de archivo .scrypt (representación visual de los 128 bytes del header)
- Modelo entidad-relación (SQLite)

---

### Capítulo 5 — Tecnologías Utilizadas (5-6 páginas)
**Contenido**:
- Node.js 20+, TypeScript 5.7, motivos de elección vs. Python/Rust
- Argon2id, AES-256-GCM: justificación técnica con referencias a NIST y OWASP
- Windows C++20 + CNG: por qué no OpenSSL en Windows
- Android Kotlin + Jetpack Compose + Android Keystore
- Ollama + Qwen2.5-Coder: por qué IA local vs. API externa
- SQLite vs. PostgreSQL: por qué el primero para un cliente
- GitHub Actions: estrategia CI/CD

---

### Capítulo 6 — Implementación (15-20 páginas)
**Contenido**:
- **6.1 Módulo criptográfico Node.js**: código comentado de `fileCipher.ts`, gestión del auth tag
- **6.2 Sistema de worker pool**: `WorkerPool` + `PauseResumeController`, manejo de concurrencia
- **6.3 API REST con sesión**: implementación del sistema de sesión, middleware de sandbox
- **6.4 Aplicación Windows C++**: CryptoEngine, SecureMemory, AntiDebug
- **6.5 Aplicación Android**: AndroidKeyStoreManager, autenticación biométrica, Room + SQLCipher
- **6.6 Módulo de IA**: RAG con hnswlib, integración Ollama, prompt engineering
- **6.7 CI/CD**: pipeline GitHub Actions, empaquetado .exe

**Capturas necesarias**:
- SecureCrypt CLI en funcionamiento (terminal)
- Interfaz web (antes y después de cifrar)
- Aplicación Windows C++ (UI completa)
- Aplicación Android (pantallas principales)
- Panel de IA (auditor de configuración + chat RAG)
- Pipeline CI/CD en GitHub Actions pasando

**Fragmentos de código clave a incluir**:
- Función de derivación de clave (Argon2id)
- Función de cifrado streaming (fileCipher.ts)
- Prompt del auditor de configuración
- Función de embedding + búsqueda vectorial

---

### Capítulo 7 — Seguridad (8-10 páginas)
**Contenido**:
- **7.1 Amenazas consideradas**: STRIDE analysis
- **7.2 OWASP ASVS cumplimiento**: tabla de controles
- **7.3 Gestión de claves**: ciclo de vida, almacenamiento (DPAPI, Android Keystore)
- **7.4 Vulnerabilidades encontradas y mitigadas**: los hallazgos de la auditoría y sus resoluciones
- **7.5 Pruebas de seguridad**: fuzzing, prueba de path traversal mitigado

**Diagramas necesarios**:
- STRIDE threat model (tabla)
- Diagrama de flujo de datos con trust boundaries (DFD)

---

### Capítulo 8 — Evaluación de la IA (10-12 páginas)
**Contenido**:
- **8.1 Diseño experimental**: metodología, dataset de evaluación
- **8.2 Evaluación del auditor de configuración**:
  - Dataset: 50 configuraciones (25 seguras / 25 inseguras)
  - Métricas: Precision, Recall, F1, tiempo de respuesta
  - Comparativa: modelo pequeño (3B) vs. mediano (7B) vs. grande (API)
- **8.3 Evaluación del sistema RAG**:
  - Dataset: 30 pares Q&A verificados por experto
  - Métricas RAGAS: Faithfulness, Answer Relevancy, Context Recall
  - Comparativa: RAG vs. LLM sin contexto (hallucination rate)
- **8.4 Rendimiento del modelo local**: latencia, consumo RAM, CPU/GPU
- **8.5 Análisis de errores**: casos donde el modelo falla

**Tablas/gráficos necesarios**:
- Tabla de resultados auditor (precision/recall/F1 por tipo de debilidad)
- Gráfico radar RAGAS metrics (RAG vs. baseline)
- Gráfico latencia vs. tamaño de modelo
- Confusion matrix del clasificador de configuraciones

---

### Capítulo 9 — Resultados y Validación (5-6 páginas)
**Contenido**:
- **9.1 Resultados funcionales**: suite de tests completa (62 tests), cobertura ≥80%
- **9.2 Resultados de rendimiento**: benchmarks de cifrado (velocidad MB/s para distintos tamaños)
- **9.3 Resultados de seguridad**: auditoría OWASP, vulnerabilidades resueltas
- **9.4 Resultados de IA**: métricas de la evaluación anterior
- **9.5 Validación con usuarios**: si es posible, 5-10 usuarios reales probando el sistema

**Tablas/gráficos necesarios**:
- Tabla de resultados de tests
- Gráfico de velocidad de cifrado (MB/s) vs. tamaño de archivo
- Comparativa velocidad Argon2id: 3 iter vs. 10 iter (impacto en usabilidad)
- Gráfico cobertura de tests

---

### Capítulo 10 — Conclusiones y Trabajo Futuro (4-5 páginas)
**Contenido**:
- Objetivos alcanzados (checklist vs. objetivos del capítulo 1)
- Lecciones aprendidas (criptografía, IA, ingeniería de software)
- Limitaciones actuales
- Trabajo futuro: KMS empresarial, fine-tuning, certificación FIPS, SaaS
- Valoración personal del aprendizaje

---

### Apéndices
- **A**: Glosario de términos criptográficos
- **B**: Referencias (IEEE/NIST/OWASP/RFC)
- **C**: Manual de instalación y uso
- **D**: Dataset de evaluación de la IA (si es público)
- **E**: Código fuente relevante (fragmentos no incluidos en el cuerpo)

---

## Checklist de Elementos Multimedia

### Diagramas (mínimo 12)
- [ ] Arquitectura general del sistema
- [ ] Diagrama de capas (Clean Architecture)
- [ ] Diagrama de Bounded Contexts (DDD)
- [ ] Diagrama de casos de uso (UML)
- [ ] Diagrama de clases principales (UML)
- [ ] Diagrama de secuencia: cifrado de archivo
- [ ] Diagrama de secuencia: autenticación
- [ ] Formato archivo .scrypt (binario visual)
- [ ] Arquitectura RAG
- [ ] DFD con trust boundaries (seguridad)
- [ ] Modelo entidad-relación
- [ ] Pipeline CI/CD

### Capturas de pantalla (mínimo 10)
- [ ] CLI en operación (cifrar + descifrar)
- [ ] API web en el navegador
- [ ] Aplicación Windows (ventana principal)
- [ ] Aplicación Android (3-4 pantallas)
- [ ] Panel de IA: auditor de configuración
- [ ] Panel de IA: chat RAG
- [ ] Tests pasando en terminal
- [ ] Pipeline CI/CD GitHub Actions verde
- [ ] Cobertura de código (vitest coverage)
- [ ] Informe de seguridad generado por la IA

### Tablas de resultados (mínimo 8)
- [ ] Comparativa de herramientas del mercado
- [ ] Resultados de tests (unitarios/integración/estrés)
- [ ] Benchmarks de rendimiento
- [ ] Evaluación auditor de config (precision/recall)
- [ ] Métricas RAGAS del RAG
- [ ] OWASP ASVS compliance
- [ ] Análisis de riesgos (STRIDE)
- [ ] Roadmap de funcionalidades

---

## Experimentos a Realizar

### Experimento 1: Benchmark de KDF
**Objetivo**: Justificar la elección de Argon2id vs. PBKDF2  
**Metodología**: Medir tiempo de derivación para distintos parámetros en hardware estándar (i5-8th gen, 8GB RAM)  
**Resultado esperado**: Argon2id con 64MB es 10-50× más costoso de romper que PBKDF2 con 600K iter

### Experimento 2: Velocidad de cifrado streaming
**Objetivo**: Demostrar escalabilidad a archivos grandes  
**Metodología**: Cifrar archivos de 1MB, 10MB, 100MB, 1GB y medir tiempo y uso de memoria  
**Resultado esperado**: Tiempo lineal, memoria constante (streaming)

### Experimento 3: Evaluación del auditor de configuración
**Objetivo**: Medir precision/recall del modelo en detectar configuraciones inseguras  
**Metodología**: Dataset de 50 configuraciones etiquetadas, 3 modelos (3B/7B/API), 5-fold cross-validation  
**Resultado esperado**: F1 ≥ 0.85 con modelo 7B

### Experimento 4: Evaluación RAG vs. baseline
**Objetivo**: Demostrar que RAG reduce alucinaciones y mejora relevancia  
**Metodología**: 30 Q&A sobre criptografía, respuestas de LLM solo vs. LLM+RAG, scoring manual por experto  
**Resultado esperado**: Faithfulness +20%, hallucination rate -40%

### Experimento 5: Rendimiento concurrente
**Objetivo**: Validar el worker pool bajo carga  
**Metodología**: 10/20/50 operaciones concurrentes, medir throughput y latencia p95  
**Resultado esperado**: Throughput lineal hasta N workers, sin degradación de latencia
