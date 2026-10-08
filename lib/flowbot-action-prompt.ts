/**
 * Formato do bloco de ações que a IA propõe e a interface transforma em card de confirmação
 * (lib/flowbot-actions.ts). Compartilhado entre o assistente do projeto e a ata do conselho
 * de IAs, para os dois falarem exatamente o mesmo protocolo.
 */
export const FLOWBOT_ACTIONS_FORMAT = `Formato: ao final da mensagem, UM bloco de codigo assim:

\`\`\`flowbot-actions
{"actions": [ { "type": "...", ... } ]}
\`\`\`

Tipos de acao (use exatamente estes nomes de campo; datas no formato AAAA-MM-DD):
- {"type":"create_requirement","description":"...","category":"Funcional"|"Nao Funcional","priority":"Alta"|"Media"|"Baixa","level":"Sistema"|"Subsistema"|"Componente"}
- {"type":"update_requirement","code":"RF01","description":"...","priority":"...","status":"Em Aberto"|"Validado"|"Descartado"}
- {"type":"delete_requirement","code":"RF01"}
- {"type":"create_feature","name":"...","description":"...","status":"Planejada"|"Em desenvolvimento"|"Concluida","requirementCode":"RF01"}
- {"type":"update_feature","name":"nome exato","status":"...","description":"..."}
- {"type":"create_sprint","name":"Sprint 1 — ...","goal":"...","startDate":"AAAA-MM-DD","endDate":"AAAA-MM-DD"}
- {"type":"create_task","title":"...","description":"...","priority":"Alta"|"Media"|"Baixa","assignee":"...","participants":["..."],"dueDate":"AAAA-MM-DD","requirementCode":"RF01","featureName":"...","sprintName":"...","columnName":"Backlog"}
- {"type":"update_task","title":"titulo exato","priority":"...","assignee":"...","dueDate":"...","sprintName":"...","columnName":"..."}
- {"type":"move_task","title":"titulo exato","columnName":"Em Progresso"}
- {"type":"create_component","name":"...","description":"...","quantity":1,"unitPrice":0,"domain":"Hardware"|"Software","requirementCode":"RF01"}

Regras do bloco: categoria "Funcional" ou "Nao Funcional" (a interface corrige acentos);
referencie requisitos pelo codigo, funcionalidades e sprints pelo nome e colunas pelo nome
exato do contexto; responsavel (assignee) e participantes so com nomes da Equipe do contexto, sem o cargo; sem nome adequado,
deixe sem responsavel. Nao crie o que ja existe no projeto (inclusive tarefas concluidas): para
algo equivalente, use update_task. Toda tarefa criada leva description curta com o criterio de
aceite ("... Aceite: ..."). So proponha move_task quando a pessoa pedir ou houver motivo claro,
e diga o motivo no texto antes do bloco.`
