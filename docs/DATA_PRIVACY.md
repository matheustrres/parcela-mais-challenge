# Privacidade, segurança e dados sintéticos

## Objetivo

Garantir que o projeto demonstre cuidado proativo com dados sensíveis, especialmente por envolver pacientes, clínicas, pagamentos e cobrança.

## Regra principal

Usar exclusivamente dados sintéticos.

Não usar dados reais em:

- seed;
- exemplos de payload;
- testes;
- screenshots;
- vídeo;
- logs;
- prompts de IA;
- documentação.

## Dados permitidos

Exemplos seguros:

```txt
Paciente Sintético 01
ana.sintetica@example.test
+5500000000000
clinic_001
```

Domínios recomendados:

```txt
example.test
example.com
```

Telefones fictícios:

```txt
+5500000000000
+5511999990000
```

## Dados proibidos

Nunca usar:

- CPF real;
- RG real;
- telefone real;
- e-mail real;
- endereço real;
- nome completo real de paciente;
- diagnóstico;
- procedimento médico;
- prontuário;
- observações clínicas;
- anexos reais;
- links reais de pagamento.

## Minimização de dados

O sistema deve armazenar apenas o necessário para demonstrar cobrança:

- nome sintético;
- contato sintético;
- canal preferido;
- acordo financeiro;
- parcelas;
- pagamentos;
- comunicações simuladas.

Não armazenar motivo clínico do tratamento.

## Dados financeiros

Valores financeiros devem ser tratados como sensíveis.

Regras:

- armazenar em centavos;
- evitar logs com payload completo;
- mascarar identificadores em logs quando necessário;
- não expor dados de outra clínica.

## Isolamento por clínica

Toda query de dados operacionais deve respeitar `clinicId`.

Endpoints de listagem devem receber ou inferir `clinicId`.

No MVP sem autenticação completa, `clinicId` pode vir como parâmetro explícito para facilitar demonstração.

## IA e privacidade

Mesmo usando dados sintéticos, prompts de IA devem conter apenas dados mínimos.

Permitido:

```json
{
  "patientFirstName": "Ana",
  "amountCents": 50000,
  "dueDate": "2026-05-28",
  "daysOverdue": 6
}
```

Proibido:

```json
{
  "diagnosis": "...",
  "procedure": "...",
  "document": "...",
  "medicalNotes": "..."
}
```

## Logs

Não logar:

- body completo de criação de paciente;
- mensagens completas se contiverem dados pessoais;
- headers de autorização;
- chaves de API;
- payload completo de webhook em produção.