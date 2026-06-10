# SecureCrypt: Sistema de Cifrado de Archivos con Asistente Inteligente Basado en RAG

---

**Trabajo de Fin de Máster**

Máster Universitario en Ciberseguridad y Computación

---

**Autor:** Gabriel Del Toya  
**Email:** gabideltoya@gmail.com  
**Repositorio:** https://github.com/Warru-coder/criptografia

**Director del TFM:** _[Nombre del director]_  
**Departamento:** _[Departamento]_  
**Universidad:** _[Universidad]_

**Curso académico:** 2025–2026  
**Fecha de entrega:** _[fecha]_

---

## Resumen (Abstract)

Este Trabajo de Fin de Máster presenta el diseño, implementación y evaluación de SecureCrypt, una plataforma de cifrado de archivos de código abierto que integra un asistente inteligente especializado en criptografía aplicada. La arquitectura web-first utiliza AES-256-GCM para cifrado autenticado y Argon2id como función de derivación de claves, cumpliendo con las recomendaciones actuales de OWASP (2024) y NIST SP 800-38D.

La aportación principal es la implementación de un sistema RAG (Retrieval Augmented Generation) local que combina una base de conocimiento estructurada sobre estándares criptográficos (NIST, OWASP, RFC) con un modelo de lenguaje grande ejecutado localmente mediante Ollama, eliminando la dependencia de servicios cloud y preservando la privacidad del usuario.

El sistema incluye además un auditor de configuración criptográfica basado en 9 reglas formalizadas de NIST/OWASP, capaz de detectar configuraciones inseguras y proporcionar recomendaciones de remediación con referencias a estándares reales.

Los experimentos demuestran que el sistema alcanza [X] MB/s de throughput en cifrado AES-256-GCM, un tiempo de derivación de claves de [Y]ms con Argon2id (parámetros OWASP), y una precisión del [Z]% en la detección de configuraciones vulnerables.

**Palabras clave:** cifrado simétrico, AES-256-GCM, Argon2id, RAG, LLM local, auditoría criptográfica, OWASP, NIST, TypeScript, seguridad web.

---

**Keywords:** symmetric encryption, AES-256-GCM, Argon2id, RAG, local LLM, cryptographic auditing, OWASP, NIST, TypeScript, web security.
