// Configuração pública do site. Qualquer mudança aqui vai ao ar sozinha a cada envio ao GitHub.
export default {
  // Base de festivais: arquivo CSV deste repositório (site/dados/festivais.csv),
  // atualizado pela tarefa semanal e publicado junto com o site.
  sheetCsvUrl: "/dados/festivais.csv",

  // Login e festivais salvos (Supabase). Enquanto vazio, o site funciona sem login.
  supabaseUrl: "https://hhzwncwcmfmianmvwryv.supabase.co",
  supabaseAnonKey: "sb_publishable_HDDju27GseeCn9IEHYucrA_-OTFsXQE", // chave pública (nunca a secreta)
  // Link de inscrição da newsletter Curió (Substack). Vazio = banner escondido.
  curioUrl: "",
};
