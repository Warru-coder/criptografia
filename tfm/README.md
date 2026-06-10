# TFM — SecureCrypt: Sistema de Cifrado de Archivos con Asistente Inteligente

**Trabajo de Fin de Máster** · Máster en Ciberseguridad y Computación  
**Autor:** Gabriel  
**Director:** _pendiente de asignar_  
**Fecha:** Junio 2026

---

## Estructura del directorio

```
tfm/
├── memoria/          # Capítulos completos de la memoria escrita
│   ├── 00_portada.md
│   ├── 01_introduccion.md
│   ├── 02_estado_arte.md
│   ├── 03_objetivos.md
│   ├── 04_arquitectura.md
│   ├── 05_implementacion.md
│   ├── 06_ai_integration.md
│   ├── 07_seguridad.md
│   ├── 08_evaluacion.md
│   ├── 09_conclusiones.md
│   └── 10_bibliografia.md
├── experimentos/     # Protocolos y plantillas de resultados
│   ├── EXP-001_argon2id_benchmark.md
│   ├── EXP-002_aes_throughput.md
│   ├── EXP-003_ai_audit_accuracy.md
│   ├── EXP-004_rag_retrieval_quality.md
│   └── EXP-005_security_penetration.md
├── presentacion/     # Guión y estructura de la defensa oral
│   └── defensa.md
└── README.md         # Este archivo
```

## Estado actual

| Capítulo | Estado |
|----------|--------|
| 01 Introducción | Borrador |
| 02 Estado del Arte | Borrador |
| 03 Objetivos | Borrador |
| 04 Arquitectura | Borrador |
| 05 Implementación | Borrador |
| 06 Integración IA | Borrador |
| 07 Seguridad | Borrador |
| 08 Evaluación | Plantilla |
| 09 Conclusiones | Borrador |
| 10 Bibliografía | Parcial |

## Resumen ejecutivo

SecureCrypt es una plataforma de cifrado de archivos que combina:

- **Cifrado AES-256-GCM** con derivación de claves Argon2id (conforme OWASP 2024)
- **Arquitectura web** (Node.js/Express/TypeScript) con interfaz de terminal cyberpunk
- **Asistente IA** basado en RAG (Retrieval Augmented Generation) con LLM local (Ollama)
- **Auditor de configuración** criptográfica con 9 reglas NIST/OWASP
- **Multiplataforma**: web-first, con apps nativas para Windows (C++/Win32) y Android (Kotlin/Jetpack Compose)

La aportación académica principal es la integración de un sistema RAG especializado en criptografía aplicada, capaz de proporcionar recomendaciones técnicas precisas basadas en estándares reales sin depender de servicios cloud.
