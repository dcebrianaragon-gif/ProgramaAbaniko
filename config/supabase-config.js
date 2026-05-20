(() => {
  const runtimeConfig = window.AbanikoBuildConfig || {};
  const DEFAULT_SHEETS_EXEC_URL = "https://script.google.com/macros/s/AKfycbzxZJcMnoYA8p6KwhdGA0tzQKhR2FD2SIVO_y1a_k2vmGR2_x8avxfXFz8D92Cj6CPO/exec";
  const sheetsWebAppUrl = String(runtimeConfig.sheetsWebAppUrl || DEFAULT_SHEETS_EXEC_URL).trim();

  window.AbanikoCloudConfig = {
    enabled: false,
    provider: "supabase",
    supabaseUrl: "https://hmgripzugbzhxkrlfhrx.supabase.co",
    projectRef: "hmgripzugbzhxkrlfhrx",
    apiKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtZ3JpcHp1Z2J6aHhrcmxmaHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNTM5NDEsImV4cCI6MjA5MzYyOTk0MX0.2W_hI3opO4rCOUCoAiWf5jrdMuSbtLr8Y-gmLa29-V4",
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
