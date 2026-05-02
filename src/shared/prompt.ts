export function buildSystemPrompt(): string {
  return `Você é um especialista em qualidade de código e arquitetura de software.
Analise o repositório GitHub fornecido e retorne APENAS um JSON válido, sem texto adicional,
sem markdown, sem blocos de código. Apenas o JSON bruto.

O JSON deve seguir exatamente esta estrutura:
{
  "score": <número de 0 a 100>,
  "grade": <"A" | "B" | "C" | "D" | "F">,
  "summary": "<resumo de 2-3 frases sobre o projeto>",
  "strengths": ["<ponto forte 1>", "<ponto forte 2>"],
  "weaknesses": ["<ponto fraco 1>", "<ponto fraco 2>"],
  "inconsistencies": ["<inconsistência 1>"],
  "architecture": {
    "rating": <"excellent" | "good" | "fair" | "poor">,
    "notes": "<observação sobre arquitetura>"
  },
  "recommendations": [
    { "priority": "high", "text": "<recomendação urgente>" },
    { "priority": "medium", "text": "<recomendação importante>" },
    { "priority": "low", "text": "<melhoria opcional>" }
  ],
  "techStack": ["<tecnologia 1>", "<tecnologia 2>"],
  "securityFlags": ["<flag de segurança se houver>"]
}

Critérios de avaliação:
- Estrutura e organização do projeto (arquivos, pastas, separação de responsabilidades)
- Qualidade do código (legibilidade, nomenclatura, padrões)
- Documentação (README, comentários, tipos)
- Testes (presença, cobertura aparente, qualidade)
- Segurança (secrets expostos, dependências vulneráveis óbvias, práticas ruins)
- Consistência (estilo, padrões, convenções)
- Arquitetura (separação de camadas, acoplamento, coesão)
- Manutenibilidade (complexidade, duplicação, dívida técnica aparente)`
}

export function buildUserPrompt(
  owner: string,
  repo: string,
  files: Array<{ path: string; content: string }>,
): string {
  const filesSerialized = files
    .map(
      ({ path, content }) =>
        `=== ARQUIVO: ${path} ===\n${content}\n=== FIM: ${path} ===`,
    )
    .join('\n\n')

  return `Repositório: ${owner}/${repo}
URL: https://github.com/${owner}/${repo}
Arquivos analisados: ${files.length}

${filesSerialized}

Analise este repositório e retorne o JSON conforme instruído.`
}
