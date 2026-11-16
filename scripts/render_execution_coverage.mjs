/** One canonical inventory: render the human-readable view without assigning acceptance. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const cell = value => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
const code = value => `\`${cell(value)}\``;
const paths = refs => (refs ?? []).map(ref => {
  const name = typeof ref === 'string' ? ref : ref.path;
  return name ? `[${cell(name)}](../../${name})` : code(JSON.stringify(ref));
}).join('<br>') || '—';
const sources = refs => (refs ?? []).map(ref => `[${cell(ref.path)}:${ref.startLine}${ref.endLine === ref.startLine ? '' : `–${ref.endLine}`}](../../${ref.path}#L${ref.startLine}${ref.endLine === ref.startLine ? '' : `-L${ref.endLine}`})`).join('<br>') || '—';
const entrypoints = refs => (refs ?? []).map(ref => code(typeof ref === 'string' ? ref : ref.route ?? ref.path)).join('<br>') || '—';
const checks = refs => (refs ?? []).map(ref => code(typeof ref === 'string' ? ref : ref.id)).join('<br>') || '—';

export function renderExecutionCoverage(acceptance) {
  if (acceptance?.schema !== 1 || !Array.isArray(acceptance.requirements)) throw Error('Canonical acceptance.schema 1 and requirements are required');
  const rows = acceptance.requirements, counts = field => Object.entries(rows.reduce((out, row) => {out[row[field]] = (out[row[field]] ?? 0) + 1; return out;}, {})).map(([name, count]) => `${name} ${count}`).join(' / ');
  const lines = [
    '# 首星视觉覆盖与执行验收', '',
    '> 此文件由 `scripts/render_execution_coverage.mjs` 从 `ASSET_REGISTRY.json.acceptance` 生成。先更新唯一登记，再生成视图；历史媒体不代表本轮完成。', '',
    `基线运行源码：${code(acceptance.baselineRuntime)}。当前交付声明：${code(acceptance.delivery?.status ?? 'PENDING')}；${cell(acceptance.delivery?.title ?? '待用户/真机验收')}。`, '',
    `共 ${rows.length} 项（${rows.filter(row => row.parent === null).length} 个父项 / ${rows.filter(row => row.parent !== null).length} 个子项）；用户视觉和真实手机独立登记。`, '',
    '| 维度 | 当前登记 |', '|---|---|',
    ...['implementation', 'evidence', 'visual', 'phone'].map(field => `| ${code(field)} | ${cell(counts(field))} |`), '',
    '工程全绿与图片数量不构成艺术签收；门禁的 `NOT_READY`、具体缺口与固定包证明单独读取。', '',
    `固定包证明：${acceptance.delivery?.proof ? paths([acceptance.delivery.proof]) : '尚未绑定'}。`, '',
    '## 当前最小集与全部有效子项', '',
  ];
  for (const parent of rows.filter(row => row.parent === null)) {
    const group = [parent, ...rows.filter(row => row.parent === parent.id)];
    lines.push(`### ${parent.id} · ${cell(parent.requirement ?? '')}`, '', '| ID / 原要求与出处 | 四维状态 | 实现 / 正式入口 / 素材 | 自动检查 / 证据 | 当前缺口 / 下一动作 |', '|---|---|---|---|---|');
    for (const row of group) lines.push(`| ${code(row.id)} ${cell(row.requirement ?? '')}<br>${sources(row.sourceRefs)}<br>${code(row.scope)}${row.carry ? `<br>承接：${cell(row.carry)}` : ''} | ${['implementation', 'evidence', 'visual', 'phone'].map(field => `${field}: ${code(row[field])}`).join('<br>')} | ${paths(row.code)}<br>入口：${entrypoints(row.entrypoints)}<br>素材：${paths(row.assets)} | ${checks(row.checks)}<br>${paths(row.proofs)} | 缺口：${cell(row.gap) || '—'}<br>下一动作：${cell(row.nextAction) || '—'} |`);
    lines.push('');
  }
  lines.push('## 明确替代的历史规则', '', '| ID / 范围 | 原规则出处 | 当前替代依据 | 生效规则 |', '|---|---|---|---|');
  for (const rule of acceptance.supersededRules ?? []) lines.push(`| ${code(rule.id)}<br>${cell(rule.scope)} | ${sources(rule.originalRefs ?? rule.originalSourceRefs ?? rule.sourceRefs)} | ${sources(rule.replacementRefs ?? rule.replacementSourceRefs)} | ${cell(rule.rule ?? rule.reason)} |`);
  lines.push('', '## 原要求来源覆盖', '', ...((acceptance.sourceCoverage?.documents ?? []).map(name => `- [${name}](../../${name})`)), '', cell(acceptance.sourceCoverage?.method ?? acceptance.sourceCoverage?.policy ?? ''), '', '历史事实分类不转成当前通过；有效条款仍须由要求行或有替代依据的规则承接。', '');
  if (acceptance.historyMarkdown) lines.push(acceptance.historyMarkdown.trimEnd(), '');
  return `${lines.join('\n').trimEnd()}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--write', '--check'].includes(args[0])) {console.error('Usage: node scripts/render_execution_coverage.mjs --write|--check'); process.exitCode = 2;}
  else {
    const registry = JSON.parse(await fs.readFile('design/visual-renewal/ASSET_REGISTRY.json', 'utf8'));
    const destination = registry.acceptance?.rendering?.document ?? 'design/visual-renewal/VISUAL_COVERAGE.md';
    const expected = renderExecutionCoverage(registry.acceptance);
    if (args[0] === '--write') {await fs.writeFile(destination, expected); console.log(`Rendered ${registry.acceptance.requirements.length} canonical requirements to ${destination}`);}
    else if (await fs.readFile(destination, 'utf8') !== expected) {console.error(`${destination} differs from canonical acceptance; run node scripts/render_execution_coverage.mjs --write`); process.exitCode = 1;}
    else console.log('Canonical execution coverage is synchronized.');
  }
}
