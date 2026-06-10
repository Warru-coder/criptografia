# Plan de Integración de IA — SecureCrypt

> El TFM pertenece al área de Desarrollo de Software con IA. La IA debe ser relevante, justificada y aportar valor real.

---

## 1. Visión General

SecureCrypt ya tiene una base de integración de IA (sistema de agentes OpenCode con Ollama local). El objetivo de este plan es **extender la IA del entorno de desarrollo al producto en sí**, haciendo que los usuarios finales se beneficien directamente de capacidades inteligentes.

### Principios Guía
1. **IA que resuelve problemas reales** del usuario de criptografía
2. **Privacidad primero**: las opciones deben funcionar con LLMs locales (Ollama)
3. **Transparencia**: el usuario siempre sabe qué está analizando la IA
4. **Valor medible**: cada función de IA tiene una métrica de éxito

---

## 2. Funcionalidades Propuestas

### 2.1 Auditor de Configuración Criptográfica (AI-FEAT-001)
**Prioridad**: ALTA — máximo valor académico y comercial

**Problema que resuelve**: Los usuarios no saben si su configuración de cifrado es suficiente para sus necesidades. Elegir Argon2id con `memoryCost=4096` en lugar de `65536` reduce drásticamente la seguridad sin que el usuario lo sepa.

**Descripción**: Un analizador que revisa los parámetros de configuración del vault y produce un informe de seguridad con recomendaciones.

**Implementación**:
```typescript
// Entrada
interface CryptoConfig {
  algorithm: 'AES-256-GCM' | 'AES-128-GCM';
  kdf: 'argon2id' | 'pbkdf2';
  argon2Params?: { memoryCost: number; timeCost: number; parallelism: number };
  pbkdf2Params?: { iterations: number; hash: string };
}

// Prompt al LLM
const prompt = `
Eres un experto en criptografía. Analiza esta configuración y detecta debilidades:
${JSON.stringify(config, null, 2)}

Contexto: La configuración se usará para proteger documentos empresariales sensibles.
Responde en JSON con: { risk_level, findings[], recommendations[], compliant_with_owasp }
`;
```

**Modelo recomendado**: Qwen2.5-Coder:7B (local, ya configurado) o Claude claude-haiku-4-5 (API)

**Coste de implementación**: 2-3 días

**Valor académico**: Demuestra integración de LLM con análisis de seguridad, prompt engineering estructurado, salida tipada con JSON schema

**Valor comercial**: Diferenciador claro — "El único gestor de cifrado que te avisa si tu configuración es insegura"

---

### 2.2 Asistente de Criptografía con RAG (AI-FEAT-002)
**Prioridad**: ALTA — demostrable en TFM, alto valor educativo

**Problema que resuelve**: Los usuarios no entienden los conceptos criptográficos subyacentes. "¿Por qué necesito Argon2id?", "¿Qué es un IV?", "¿Es seguro AES-128?".

**Descripción**: Un chat especializado que responde preguntas sobre criptografía usando:
1. Una base de conocimiento vectorizada (NIST guidelines, OWASP Cryptography Cheat Sheet, RFC de AES-GCM, paper de Argon2)
2. Contexto de la configuración actual del usuario

**Arquitectura RAG**:
```
Usuario pregunta → Embedding de la pregunta
                        ↓
            Búsqueda en vector store (chromadb/hnswlib)
                        ↓
            Recupera chunks relevantes (Top-K = 5)
                        ↓
            Construye prompt con contexto + configuración actual del usuario
                        ↓
            LLM genera respuesta fundamentada en documentación real
```

**Stack técnico**:
- Embedding: `nomic-embed-text` (Ollama, local, 137M parámetros)
- Vector store: `hnswlib-node` (sin servidor, fichero local)
- LLM: Qwen2.5-Coder:7B o `llama3.2:3b` para respuestas rápidas
- Documentos a vectorizar: OWASP Crypto Cheat Sheet, NIST SP 800-131A, RFC 8018 (PBKDF2), RFC 9106 (Argon2)

**Coste de implementación**: 5-7 días

**Valor académico**: RAG completo, evaluación con RAGAS metrics, comparativa con respuestas sin RAG

**Valor comercial**: "Pregunta a SecureCrypt por qué AES-GCM es mejor que AES-CBC"

---

### 2.3 Detector de Configuraciones Inseguras en Tiempo Real (AI-FEAT-003)
**Prioridad**: MEDIA — buena demostración de IA aplicada a seguridad

**Problema que resuelve**: Un usuario puede crear un vault con parámetros débiles (por rendimiento, por equivocación) sin ninguna advertencia.

**Descripción**: Hook que se ejecuta antes de cada operación de cifrado y evalúa si los parámetros son seguros para el tipo de archivo.

**Implementación**:
```typescript
class SecurityAdvisor {
  async evaluateBeforeEncrypt(
    config: CryptoConfig,
    fileMetadata: { sizeBytes: number; estimatedSensitivity: 'low' | 'medium' | 'high' }
  ): Promise<SecurityAdvice> {
    // Reglas determinísticas rápidas (sin LLM)
    const staticIssues = this.runStaticRules(config);
    
    // Solo llamar al LLM para análisis complejo o cuando hay issues
    if (staticIssues.length > 0 || fileMetadata.estimatedSensitivity === 'high') {
      return await this.llmAnalyze(config, fileMetadata, staticIssues);
    }
    
    return { approved: true, warnings: [] };
  }
}
```

**Modelo recomendado**: Reglas estáticas primero, LLM solo como fallback para casos complejos.

**Coste de implementación**: 3-4 días

---

### 2.4 Clasificador de Sensibilidad de Archivos (AI-FEAT-004)
**Prioridad**: MEDIA — innovador, diferenciador comercial

**Problema que resuelve**: El usuario no siempre sabe qué nivel de protección necesita cada archivo. Un `.txt` con notas puede contener información muy sensible; un `.jpg` puede ser público.

**Descripción**: Analiza el nombre del archivo, extensión y opcionalmente los primeros bytes del header para sugerir el nivel de protección recomendado.

**IMPORTANTE**: Nunca leer el contenido completo del archivo — solo metadata y magic bytes.

```typescript
interface SensitivityAnalysis {
  estimatedLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  confidence: number;
  reasoning: string;
  recommendedParams: KeyDerivationParams;
}

// Ejemplo de prompt
const prompt = `
Archivo: "nomina_junio_2025.xlsx"
Extension: .xlsx (Excel)
Patron de nombre: contiene "nomina" (español: payroll)
Magic bytes: PK.. (ZIP/OOXML)

¿Qué nivel de sensibilidad tiene este archivo para una empresa?
Responde en JSON: { level, confidence, reasoning, kdf_recommendation }
`;
```

**Coste de implementación**: 3 días

**Valor académico**: NLP aplicado a clasificación de documentos, evaluación con dataset etiquetado manualmente

---

### 2.5 Generador Automático de Documentación de Operaciones (AI-FEAT-005)
**Prioridad**: BAJA — valor TFM elevado, uso práctico limitado

**Problema que resuelve**: En entornos empresariales, las operaciones de cifrado/descifrado necesitan registro y documentación para auditorías.

**Descripción**: Genera un resumen legible en lenguaje natural de las operaciones realizadas.

```
Operación cifrado — 14 jun 2026, 10:32
Archivos procesados: 47 documentos en /Contratos/2025/
Algoritmo: AES-256-GCM con Argon2id (parámetros: OWASP High)
Tiempo total: 2m 34s
Estado: Completado correctamente

Nota generada por IA: "Todos los archivos de contratos del directorio Contratos/2025/ 
han sido cifrados correctamente. Los parámetros utilizados superan los requisitos 
GDPR artículo 32 para protección de datos de alta sensibilidad."
```

**Coste de implementación**: 1-2 días

---

## 3. Plan de Implementación

### Fase 1 — TFM (Mínimo para defender)
| Feature | Semanas | Prioridad |
|---|---|---|
| AI-FEAT-001: Auditor de config | S1-S2 | Obligatorio |
| AI-FEAT-002: Chat RAG | S3-S5 | Obligatorio |
| Métricas y evaluación | S5-S6 | Obligatorio |

### Fase 2 — Portfolio
| Feature | Semanas | Prioridad |
|---|---|---|
| AI-FEAT-003: Detector en tiempo real | S7-S8 | Recomendado |
| AI-FEAT-004: Clasificador | S9-S10 | Opcional |

### Fase 3 — Comercial
- Fine-tuning de modelo con feedback de usuarios
- API de auditoría como servicio (CaaS)
- Integración con SIEM corporativos

---

## 4. Evaluación y Métricas

### Para el TFM (necesario demostrar rigor)

#### AI-FEAT-001 (Auditor de config)
- **Métrica**: Precisión en detección de configuraciones inseguras vs. checklist OWASP manual
- **Dataset**: 50 configuraciones etiquetadas (25 seguras, 25 inseguras con distintos tipos de debilidades)
- **Objetivo**: Precision ≥ 0.85, Recall ≥ 0.90 (falso negativo es más crítico)

#### AI-FEAT-002 (RAG)
- **Métricas RAGAS**: Faithfulness, Answer Relevancy, Context Recall
- **Dataset**: 30 pares pregunta-respuesta verificados por experto
- **Comparativa**: RAG vs. LLM sin contexto (baseline)
- **Objetivo**: Faithfulness ≥ 0.80, Answer Relevancy ≥ 0.75

---

## 5. Consideraciones de Privacidad

### Modo Local (Ollama) — Default
- Todo el procesamiento ocurre en el dispositivo del usuario
- Ningún dato sale del sistema
- Ideal para casos de uso con datos sensibles
- Requisito de hardware: 8GB RAM para Qwen2.5:7B, 4GB para modelos 3B

### Modo Cloud (Claude API) — Opt-in
- Solo disponible con consentimiento explícito del usuario
- Los datos enviados deben ser anonimizados (solo metadatos, nunca contenido de archivos)
- Ideal para usuarios con hardware limitado
- Requiere términos de servicio claros sobre procesamiento de datos

### Implementación del switch
```typescript
interface AIProviderConfig {
  mode: 'local' | 'cloud';
  localConfig?: { baseURL: string; model: string }; // Ollama
  cloudConfig?: { apiKey: string; model: string };  // Claude API
}
```

---

## 6. Arquitectura de la Capa de IA

```
┌─────────────────────────────────────────────────────────┐
│                    AI Domain                            │
│                                                         │
│  ┌─────────────────┐    ┌──────────────────────────┐   │
│  │  ConfigAuditor  │    │     RAGService            │   │
│  │  Service        │    │  ┌──────────────────────┐ │   │
│  │  ┌───────────┐  │    │  │  Document Indexer    │ │   │
│  │  │ Static    │  │    │  │  (PDF/MD → chunks)   │ │   │
│  │  │ Rules     │  │    │  └──────────────────────┘ │   │
│  │  └───────────┘  │    │  ┌──────────────────────┐ │   │
│  │  ┌───────────┐  │    │  │  Embedding Service   │ │   │
│  │  │ LLM       │  │    │  │  (nomic-embed-text)  │ │   │
│  │  │ Analysis  │  │    │  └──────────────────────┘ │   │
│  │  └───────────┘  │    │  ┌──────────────────────┐ │   │
│  └─────────────────┘    │  │  Vector Store        │ │   │
│                         │  │  (hnswlib-node)      │ │   │
│  ┌─────────────────┐    │  └──────────────────────┘ │   │
│  │  Sensitivity    │    │  ┌──────────────────────┐ │   │
│  │  Classifier     │    │  │  LLM (Qwen/Claude)   │ │   │
│  └─────────────────┘    │  └──────────────────────┘ │   │
│                         └──────────────────────────┘   │
│                                                         │
│              ILLMProvider Port                          │
│         ┌──────────┬──────────┐                        │
│         │  Ollama  │  Claude  │  ← Adapters             │
│         │ Adapter  │ Adapter  │                        │
│         └──────────┴──────────┘                        │
└─────────────────────────────────────────────────────────┘
```
