import test from "node:test";
import assert from "node:assert/strict";
import { memberRows, selectActivity, buildInviteEmail, normEmail, validEmail } from "../netlify/lib/equipe.mjs";
import { buildDigest } from "../netlify/lib/novidades.mjs";

const prof = { email: "f@x.com", email_opt_in: true, reminder_days: [7] };

test("membros recebem as linhas do projeto conforme o aviso escolhido", () => {
  const saved = [{ film_id: "f1", festival_id: "a", status: "quero" }, { film_id: "f2", festival_id: "b", status: "quero" }];
  const members = [
    { film_id: "f1", user_id: "u2", role: "editor", remind: true, changes: false, profiles: prof },
    { film_id: "f1", user_id: "u1", role: "dono", remind: true, changes: true, profiles: prof },
    { film_id: "f2", user_id: "u3", role: "leitor", remind: false, changes: true, profiles: prof },
  ];
  assert.deepEqual(memberRows({ saved, members, flag: "remind" }).map((r) => [r.user_id, r.festival_id]), [["u2", "a"]]);
  assert.deepEqual(memberRows({ saved, members, flag: "changes" }).map((r) => [r.user_id, r.festival_id]), [["u3", "b"]]);
});

test("resumo da equipe mostra só o que outras pessoas fizeram", () => {
  const activity = [
    { id: 1, film_id: "f1", actor: "u1", kind: "incluiu", festival_id: "a" },
    { id: 2, film_id: "f1", actor: "u2", kind: "situacao", festival_id: "a", detail: "inscrito" },
  ];
  const members = [{ film_id: "f1", user_id: "u2", activity: true, profiles: prof }, { film_id: "f1", user_id: "u1", activity: false, profiles: prof }];
  const out = selectActivity({ activity, members, festivals: [{ id: "a", name: "Kinoforum" }], names: new Map([["u1", "Ana"]]), films: new Map([["f1", "Curta"]]) });
  assert.equal(out.size, 1);
  const u = out.get("u2");
  assert.deepEqual(u.activityIds, [1]);
  assert.equal(`${u.activity[0].who} ${u.activity[0].what} ${u.activity[0].festival}`, "Ana incluiu Kinoforum");
  const d = buildDigest({ changes: [], searches: [], activity: u.activity, siteUrl: "https://x", unsubscribeUrl: "https://x/u" });
  assert.match(d.subject, /Equipe: Ana incluiu Kinoforum/);
  assert.match(d.html, /Na equipe de <b>Curta<\/b>/);
});

test("convite por e-mail", () => {
  assert.equal(normEmail(" Felipe@Gmail.com "), "felipe@gmail.com");
  assert.ok(validEmail("a@b.co"));
  assert.ok(!validEmail("ab.co"));
  const e = buildInviteEmail({ inviter: "Ana", film: "Curta <b>", role: "leitor", email: "f@x.com", link: "https://x/?convite=1" });
  assert.match(e.subject, /Ana convidou você para o projeto Curta/);
  assert.match(e.html, /apenas visualização/);
  assert.match(e.html, /Curta &lt;b&gt;/);
  assert.match(e.text, /https:\/\/x\/\?convite=1/);
  assert.doesNotMatch(e.html + e.text, /—/);
});
