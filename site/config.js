// Configuração pública do site. Qualquer mudança aqui vai ao ar sozinha a cada envio ao GitHub.
export default {
  // Base de festivais: arquivo CSV deste repositório (site/dados/festivais.csv),
  // atualizado pela tarefa semanal e publicado junto com o site.
  sheetCsvUrl: "/dados/festivais.csv",

  // Login e festivais salvos (Supabase). Enquanto vazio, o site funciona sem login.
  supabaseUrl: "https://hhzwncwcmfmianmvwryv.supabase.co",
  supabaseAnonKey: "sb_publishable_HDDju27GseeCn9IEHYucrA_-OTFsXQE", // chave pública (nunca a secreta)
  // Newsletter Curió: link de inscrição. O banner só aparece com curioBanner: true,
  // depois que curio-banner.webp e curio-banner-celular.webp estiverem em site/img/.
  curioUrl: "https://curiozine.substack.com",
  curioBanner: true,
};
