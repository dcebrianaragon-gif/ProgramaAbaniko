(() => {
  const runtimeConfig = window.AbanikoBuildConfig || {};
  const DEFAULT_SHEETS_EXEC_URL = "";
  const sheetsWebAppUrl = String(runtimeConfig.sheetsWebAppUrl || DEFAULT_SHEETS_EXEC_URL).trim();

  window.AbanikoCloudConfig = {
    enabled: false,
    provider: "supabase",
    supabaseUrl: "https://hmgripzugbzhxkrlfhrx.supabase.co",
    projectRef: "hmgripzugbzhxkrlfhrx",
    apiKey: "PEGA_AQUI_LA_CLAVE_ANON_PUBLICA",
    tableName: "app_state",
    appId: "programa-abaniko",
    realtime: true,
    pollIntervalMs: 30000
  };

  window.AbanikoSheetsConfig = {
    enabled: Boolean(sheetsWebAppUrl),
    webAppUrl: sheetsWebAppUrl,
    appId: "programa-abaniko",
    pollIntervalMs: 30000
  };
})();
