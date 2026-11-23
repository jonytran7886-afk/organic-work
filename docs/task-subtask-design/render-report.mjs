import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

// Documentation renderer only: no application or database mutations.
const root = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(root, "index.html");
const data = JSON.parse(fs.readFileSync(path.join(root, "review-data.json"), "utf8"));
const files = fs.readdirSync(root).filter((name) => /^0[1-7]-.+\.md$/.test(name)).sort();
const escape = (value) => String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const docId = (name) => `doc-${name.slice(0, 2)}`;

function localHref(href) {
  const [file, hash] = href.split("#");
  if (files.includes(file)) return `#${docId(file)}`;
  if (file === "index.html") return hash ? `#${hash}` : "#top";
  return href;
}

function inline(text) {
  const tokens = [];
  const token = (value) => `\u0000${tokens.push(value) - 1}\u0000`;
  const intermediate = text
    .replace(/`([^`]+)`/g, (_, code) => token(`<code>${escape(code)}</code>`))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      assert(!/^\s*(javascript|data):/i.test(href), "Unsafe document link");
      return token(`<a href="${escape(localHref(href))}">${escape(label)}</a>`);
    });
  return escape(intermediate)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)]);
}

function markdown(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  let html = "", paragraph = [], list = null, code = null;
  function flushParagraph() { if (paragraph.length) { html += `<p>${inline(paragraph.join(" "))}</p>\n`; paragraph = []; } }
  function closeList() { if (list) { html += `</${list}>\n`; list = null; } }
  for (const line of lines) {
    if (/^```/.test(line)) {
      flushParagraph(); closeList();
      if (code !== null) { html += `<pre><code>${escape(code.join("\n"))}</code></pre>\n`; code = null; }
      else code = [];
      continue;
    }
    if (code !== null) { code.push(line); continue; }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph(); closeList();
      const level = Math.min(heading[1].length + 1, 6);
      html += `<h${level}>${inline(heading[2])}</h${level}>\n`; continue;
    }
    const item = /^(?:([-*])\s+|\d+\.\s+)(.+)$/.exec(line);
    if (item) {
      flushParagraph();
      const type = item[1] ? "ul" : "ol";
      if (list !== type) { closeList(); list = type; html += `<${type}>\n`; }
      html += `<li>${inline(item[2])}</li>\n`; continue;
    }
    if (!line.trim()) { flushParagraph(); closeList(); continue; }
    paragraph.push(line.trim());
  }
  flushParagraph(); closeList();
  assert.equal(code, null, "Unclosed code fence");
  return html;
}

function table(id, title, headers, rows, caption) {
  return `<section id="${id}"><h2>${escape(title)}</h2><div class="table-wrap" tabindex="0" role="region" aria-label="${escape(title)}"><table><caption>${escape(caption)}</caption><thead><tr>${headers.map((h) => `<th scope="col">${escape(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, i) => i ? `<td>${cell}</td>` : `<th scope="row">${cell}</th>`).join("")}</tr>`).join("\n")}</tbody></table></div></section>`;
}

assert.equal(files.length, 7);
assert.equal(data.fields.length, 28);
assert.equal(data.permissions.length, 17);
assert.equal(data.events.length, 13);
assert.equal(data.traceability.length, 12);
const fields = data.fields.map((row) => {
  const [name, clickup, current, proposal, inheritance, sourceId] = row;
  const source = sourceId ? data.sources[sourceId] : null;
  assert(!sourceId || source, `Missing source ${sourceId}`);
  return [name, clickup, current, proposal, inheritance].map(escape).concat(source ? `<a href="${escape(source[1])}">${escape(source[0])}</a>` : "Quy tắc riêng ADIGO");
});
const matrices = [
  table("field-dictionary", "Từ điển dữ liệu", ["Trường", "ClickUp / mức bắt buộc", "Repo hiện tại", "Đề xuất ADIGO", "Kế thừa", "Nguồn chính thức"], fields, "26 trường trong prompt và 2 scope phòng của repo; hiện trạng theo audit tĩnh ngày 22/11/2026"),
  `<p>Primary và assigned-by độc lập chưa được xác minh là trường native ClickUp. Các nguồn chỉ hỗ trợ cột ClickUp; đề xuất và hiện trạng repo không phải tuyên bố về ClickUp.</p>`,
  table("permission-matrix", "Ma trận quyền đề xuất", data.permissionColumns, data.permissions.map((r) => r.map(escape)), "Modern-v2, task active và canView; user nhiều role hợp quyền allow, mọi guard cấm vẫn ưu tiên; legacy-v1 giữ quyền cũ"),
  `<p>Chỉ xem gồm participant, watcher, colleague hoặc creator không có role quản lý/assignee. Quyền tạo task độc lập do role tổ chức quyết định, không do việc là creator/watch. Anonymous/inactive/outside scope bị từ chối; reviewer chỉ có quyền quyết định chu kỳ được chỉ định.</p>`,
  table("event-matrix", "Sự kiện và thông báo", data.eventColumns, data.events.map((r) => r.map(escape)), "13 nhóm sự kiện ADIGO đề xuất; external outbox at-least-once, không hứa exactly-once"),
  table("requirement-coverage", "Đối chiếu yêu cầu của prompt", data.traceColumns, data.traceability.map((r) => r.map(escape)), "12 phần prompt; thiết kế, baseline và triển khai là các trạng thái khác nhau")
].join("\n");
const documents = `<section id="full-documents"><h2>Toàn bộ hồ sơ nghiên cứu và thiết kế</h2><p>Nội dung đầy đủ đọc offline ngay bên dưới. Sáu phần chính nằm ở 01–06; 07 là phụ lục rà soát. Dùng các liên kết mục lục để đi tới từng phần.</p>${files.map((name) => {
  const source = fs.readFileSync(path.join(root, name), "utf8");
  assert(!source.includes("\uFFFD"), `Invalid UTF-8 ${name}`);
  return `<article id="${docId(name)}" class="document"><p><a href="#top">Về mục lục</a> · <a href="${escape(name)}">Nguồn Markdown</a></p>${markdown(source)}</article>`;
}).join("\n")}</section>`;

let original = fs.readFileSync(outputPath, "utf8");
function replaceBlock(html, name, content, before) {
  const begin = `<!-- BEGIN ${name} -->`, end = `<!-- END ${name} -->`;
  const replacement = `${begin}\n${content}\n${end}`;
  if (html.includes(begin)) return html.replace(new RegExp(`${begin}[\\s\\S]*?${end}`), replacement);
  assert(html.includes(before), `Missing insertion point ${name}`);
  return html.replace(before, replacement + "\n" + before);
}
let result = replaceBlock(original, "REVIEW MATRICES", matrices, '  <div class="columns">');
result = replaceBlock(result, "FULL DOCUMENTS", documents, "  <footer>");
const ids = [...result.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
assert.equal(new Set(ids).size, ids.length, "Duplicate HTML id");
for (const match of result.matchAll(/href="([^"]+)"/g)) {
  const href = match[1];
  if (href.startsWith("https://")) continue;
  const [file, hash] = href.split("#");
  if (!file) { assert(ids.includes(hash), `Missing anchor ${href}`); continue; }
  assert(fs.existsSync(path.resolve(root, decodeURIComponent(file))), `Missing link ${href}`);
}
const testPlan = fs.readFileSync(path.join(root, "06-implementation-plan-and-tests.md"), "utf8");
for (const [prefix, count] of [["U", 18], ["I", 40], ["E", 19]]) {
  const cases = [...testPlan.matchAll(new RegExp(`\\*\\*(${prefix}\\d{2})\\*\\*`, "g"))].map((m) => m[1]);
  assert.equal(cases.length, count); assert.equal(new Set(cases).size, count);
}
if (process.argv.includes("--check")) assert.equal(result, original, "Report stale: run renderer without --check");
else fs.writeFileSync(outputPath, result, "utf8");
console.log(`PASS: 7 documents; 28 fields; 17 permission actions; 13 event groups; 12 prompt sections; 77 planned tests; local links and anchors valid. ${process.argv.includes("--check") ? "Report current." : "Report rendered."}`);
