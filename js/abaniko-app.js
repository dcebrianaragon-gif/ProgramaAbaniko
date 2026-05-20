const AbanikoStore = (() => {
  const STORAGE_KEY = "programaAbanikoData";
  const SELECTED_SESSION_KEY = "programaAbanikoSelectedSessionId";
  const EDIT_SESSION_KEY = "programaAbanikoEditSessionId";
  const SELECTED_STUDENT_KEY = "programaAbanikoSelectedStudentDni";
  const EDIT_STUDENT_KEY = "programaAbanikoEditStudentDni";
  const CURRENT_TEACHER_KEY = "programaAbanikoCurrentTeacherId";
  const CURRENT_ACCESS_LOG_KEY = "programaAbanikoCurrentAccessLogId";
  const CLOUD_LAST_SYNC_KEY = "programaAbanikoCloudLastSync";
  const CLOUD_LAST_ERROR_KEY = "programaAbanikoCloudLastError";
  const CLOUD_MODE_KEY = "programaAbanikoCloudMode";
  const BACKEND_LAST_SYNC_KEY = "programaAbanikoBackendLastSync";
  const BACKEND_LAST_ERROR_KEY = "programaAbanikoBackendLastError";
  const BACKEND_MODE_KEY = "programaAbanikoBackendMode";
  const SHEETS_LAST_SYNC_KEY = "programaAbanikoSheetsLastSync";
  const SHEETS_LAST_ERROR_KEY = "programaAbanikoSheetsLastError";
  const SHEETS_WEB_APP_URL_KEY = "programaAbanikoSheetsWebAppUrl";
  const SHEETS_ENABLED_KEY = "programaAbanikoSheetsEnabled";
  const SUPABASE_SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

  let cloudPullPromise = null;
  let cloudPushPromise = null;
  let backendPullPromise = null;
  let backendPushPromise = null;
  let sheetsPullPromise = null;
  let sheetsPushPromise = null;
  let supabaseSdkPromise = null;
  let supabaseClientPromise = null;

  function isLikelySheetsWebAppUrl(value) {
    const normalized = String(value || "").trim();
    return /^https:\/\/script\.google\.com\/macros\/s\/[^/?#]+\/(?:exec|dev)(?:[?#].*)?$/i.test(normalized);
  }

  function readBootstrapSheetsUrl() {
    if (typeof window === "undefined" || !window.location) {
      return "";
    }

    const candidates = ["sheetsUrl", "sheets", "googleSheets", "appsScript", "exec"];
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(String(url.hash || "").replace(/^#/, ""));

    for (const key of candidates) {
      const searchValue = url.searchParams.get(key);
      if (isLikelySheetsWebAppUrl(searchValue)) {
        return String(searchValue).trim();
      }
      const hashValue = hashParams.get(key);
      if (isLikelySheetsWebAppUrl(hashValue)) {
        return String(hashValue).trim();
      }
    }

    return "";
  }

  function cleanBootstrapSheetsUrlFromLocation() {
    if (typeof window === "undefined" || !window.location || !window.history?.replaceState) {
      return;
    }

    const keys = ["sheetsUrl", "sheets", "googleSheets", "appsScript", "exec"];
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(String(url.hash || "").replace(/^#/, ""));

    keys.forEach((key) => {
      url.searchParams.delete(key);
      hashParams.delete(key);
    });

    const nextHash = hashParams.toString();
    const nextUrl = `${url.pathname}${url.search}${nextHash ? `#${nextHash}` : ""}`;
    window.history.replaceState({}, document.title, nextUrl);
  }

  function bootstrapSheetsConnectionFromLocation() {
    if (typeof localStorage === "undefined") {
      return;
    }

    const sheetsUrl = readBootstrapSheetsUrl();
    if (!sheetsUrl) {
      return;
    }

    localStorage.setItem(SHEETS_WEB_APP_URL_KEY, sheetsUrl);
    localStorage.setItem(SHEETS_ENABLED_KEY, "true");
    localStorage.removeItem(SHEETS_LAST_ERROR_KEY);
    cleanBootstrapSheetsUrlFromLocation();
  }

  bootstrapSheetsConnectionFromLocation();

  function createId() {
    return Date.now() + Math.floor(Math.random() * 100000);
  }

  function normalizeTeacher(teacher, totalTeachers = 0) {
    const defaultRole = totalTeachers === 0 ? "admin" : "profesor";
    return {
      id: teacher?.id || createId(),
      name: teacher?.name || "",
      subject: teacher?.subject || "",
      email: teacher?.email || "",
      phone: teacher?.phone || "",
      pin: teacher?.pin || "",
      role: teacher?.role || defaultRole,
      createdAt: teacher?.createdAt || new Date().toISOString(),
      updatedAt: teacher?.updatedAt || new Date().toISOString()
    };
  }

  function normalizeInterviewRevision(revision) {
    return {
      id: revision?.id || createId(),
      createdAt: revision?.createdAt || new Date().toISOString(),
      updatedAt: revision?.updatedAt || new Date().toISOString(),
      schoolYear: String(revision?.schoolYear || "").trim(),
      repeatYear: Boolean(revision?.repeatYear),
      interviewDate: String(revision?.interviewDate || "").trim(),
      interviewer: String(revision?.interviewer || "").trim(),
      courseStage: String(revision?.courseStage || "").trim(),
      center: String(revision?.center || "").trim(),
      currentSituation: String(revision?.currentSituation || "").trim(),
      changesSinceLastYear: String(revision?.changesSinceLastYear || "").trim(),
      supportNeeds: String(revision?.supportNeeds || "").trim(),
      goals: String(revision?.goals || "").trim(),
      agreements: String(revision?.agreements || "").trim(),
      notes: String(revision?.notes || "").trim()
    };
  }

  function normalizeInterviewRecord(record, studentDni = "") {
    const sourceRevisions = Array.isArray(record?.revisions)
      ? record.revisions
      : Array.isArray(record?.history)
        ? record.history
        : record?.data
          ? [record.data]
          : [];
    const revisions = sourceRevisions.map((revision) => normalizeInterviewRevision(revision));
    revisions.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
    return {
      id: record?.id || createId(),
      studentDni: String(record?.studentDni || studentDni || "").trim(),
      createdAt: record?.createdAt || revisions[0]?.createdAt || new Date().toISOString(),
      updatedAt: record?.updatedAt || revisions[revisions.length - 1]?.updatedAt || new Date().toISOString(),
      revisions
    };
  }

  function normalizeStudent(student) {
    const interviewSource = Array.isArray(student?.interviewRecords)
      ? student.interviewRecords
      : Array.isArray(student?.interviews)
        ? student.interviews
        : [];
    return {
      ...student,
      interviewRecords: interviewSource.map((record) => normalizeInterviewRecord(record, student?.dni || ""))
    };
  }

  function normalize(data) {
    const teachers = Array.isArray(data?.teachers) ? data.teachers : [];
    return {
      students: Array.isArray(data?.students) ? data.students.map((student) => normalizeStudent(student)) : [],
      teachers: teachers.map((teacher, index) => normalizeTeacher(teacher, index)),
      sessions: Array.isArray(data?.sessions) ? data.sessions : [],
      accessLogs: Array.isArray(data?.accessLogs) ? data.accessLogs : [],
      absences: Array.isArray(data?.absences) ? data.absences : [],
      updatedAt: data?.updatedAt || new Date().toISOString()
    };
  }

  function persistLocal(data, options = {}) {
    const normalized = normalize(data);
    normalized.updatedAt = options.preserveUpdatedAt && normalized.updatedAt
      ? normalized.updatedAt
      : new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function getBackendConfig() {
    if (typeof window === "undefined") {
      return {
        enabled: false,
        dataUrl: "",
        healthUrl: ""
      };
    }

    const protocol = window.location.protocol || "";
    const origin = window.location.origin || "";
    const hostname = window.location.hostname || "";
    const useFileServer = /^file:$/i.test(protocol);
    const useLocalHttpServer = /^https?:$/i.test(protocol)
      && ["localhost", "127.0.0.1", "::1"].includes(hostname);
    const baseUrl = useFileServer
      ? "http://127.0.0.1:3000"
      : (useLocalHttpServer ? origin : "");

    return {
      enabled: Boolean(baseUrl),
      dataUrl: baseUrl ? `${baseUrl}/api/data` : "",
      healthUrl: baseUrl ? `${baseUrl}/api/health` : ""
    };
  }

  function isBackendConfigured() {
    const config = getBackendConfig();
    return Boolean(config.enabled && config.dataUrl);
  }

  function rememberBackendError(message) {
    if (message) {
      localStorage.setItem(BACKEND_LAST_ERROR_KEY, String(message));
    } else {
      localStorage.removeItem(BACKEND_LAST_ERROR_KEY);
    }
  }

  function rememberBackendSync() {
    localStorage.setItem(BACKEND_LAST_SYNC_KEY, new Date().toISOString());
    rememberBackendError("");
  }

  function notifyBackendMode(mode) {
    localStorage.setItem(BACKEND_MODE_KEY, mode);
  }

  function getBackendStatus() {
    const config = getBackendConfig();
    return {
      enabled: config.enabled,
      configured: isBackendConfigured(),
      lastSyncAt: localStorage.getItem(BACKEND_LAST_SYNC_KEY) || "",
      lastError: localStorage.getItem(BACKEND_LAST_ERROR_KEY) || "",
      mode: localStorage.getItem(BACKEND_MODE_KEY) || "desconectado"
    };
  }

  function getSheetsConfig() {
    const config = window.AbanikoSheetsConfig || {};
    const storedUrl = localStorage.getItem(SHEETS_WEB_APP_URL_KEY) || "";
    const storedEnabled = localStorage.getItem(SHEETS_ENABLED_KEY);
    const webAppUrl = String(storedUrl || config.webAppUrl || "").trim();
    const configuredEnabled = storedEnabled === null
      ? Boolean(config.enabled)
      : storedEnabled === "true";
    return {
      enabled: Boolean(configuredEnabled && webAppUrl),
      webAppUrl,
      appId: String(config.appId || "programa-abaniko").trim(),
      pollIntervalMs: Number(config.pollIntervalMs || 30000)
    };
  }

  function setSheetsConnection(webAppUrl, enabled = true) {
    const cleanUrl = String(webAppUrl || "").trim();
    if (cleanUrl) {
      localStorage.setItem(SHEETS_WEB_APP_URL_KEY, cleanUrl);
    } else {
      localStorage.removeItem(SHEETS_WEB_APP_URL_KEY);
    }
    localStorage.setItem(SHEETS_ENABLED_KEY, enabled && cleanUrl ? "true" : "false");
    rememberSheetsError("");
    return getSheetsConfig();
  }

  function clearSheetsConnection() {
    localStorage.removeItem(SHEETS_WEB_APP_URL_KEY);
    localStorage.setItem(SHEETS_ENABLED_KEY, "false");
    rememberSheetsError("");
    return getSheetsConfig();
  }

  function isSheetsConfigured() {
    const config = getSheetsConfig();
    return Boolean(config.enabled && config.webAppUrl && config.appId);
  }

  function rememberSheetsError(message) {
    if (message) {
      localStorage.setItem(SHEETS_LAST_ERROR_KEY, String(message));
    } else {
      localStorage.removeItem(SHEETS_LAST_ERROR_KEY);
    }
  }

  function rememberSheetsSync() {
    localStorage.setItem(SHEETS_LAST_SYNC_KEY, new Date().toISOString());
    rememberSheetsError("");
  }

  function getSheetsStatus() {
    const config = getSheetsConfig();
    return {
      enabled: config.enabled,
      configured: isSheetsConfigured(),
      webAppUrl: config.webAppUrl,
      appId: config.appId,
      lastSyncAt: localStorage.getItem(SHEETS_LAST_SYNC_KEY) || "",
      lastError: localStorage.getItem(SHEETS_LAST_ERROR_KEY) || ""
    };
  }

  function loadFromBackendSync() {
    if (!isBackendConfigured() || typeof XMLHttpRequest === "undefined") {
      return null;
    }
    try {
      const request = new XMLHttpRequest();
      request.open("GET", getBackendConfig().dataUrl, false);
      request.send();
      if (request.status >= 200 && request.status < 300 && request.responseText) {
        const remote = normalize(JSON.parse(request.responseText));
        persistLocal(remote, { preserveUpdatedAt: true });
        notifyBackendMode("node");
        rememberBackendSync();
        return remote;
      }
      rememberBackendError(`Error ${request.status} al leer el backend.`);
      return null;
    } catch (error) {
      rememberBackendError(error.message || "No se pudo leer el backend.");
      return null;
    }
  }

  function getNewestData(primaryData, secondaryData) {
    const primary = normalize(primaryData);
    const secondary = normalize(secondaryData);
    return String(secondary.updatedAt || "") > String(primary.updatedAt || "") ? secondary : primary;
  }

  function hasMeaningfulData(data) {
    const normalized = normalize(data);
    return [
      normalized.students,
      normalized.teachers,
      normalized.sessions,
      normalized.accessLogs,
      normalized.absences
    ].some((items) => items.length > 0);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const remote = loadFromBackendSync();
        return remote || persistLocal({});
      }
      const local = normalize(JSON.parse(raw));
      const backend = loadFromBackendSync();
      return backend ? getNewestData(local, backend) : local;
    } catch (error) {
      console.error("No se pudo cargar la información:", error);
      const remote = loadFromBackendSync();
      return remote || persistLocal({});
    }
  }

  function rememberCloudError(message) {
    if (message) {
      localStorage.setItem(CLOUD_LAST_ERROR_KEY, String(message));
    } else {
      localStorage.removeItem(CLOUD_LAST_ERROR_KEY);
    }
  }

  function rememberCloudSync() {
    localStorage.setItem(CLOUD_LAST_SYNC_KEY, new Date().toISOString());
    rememberCloudError("");
  }

  function getCloudConfig() {
    const config = window.AbanikoCloudConfig || {};
    const defaultCloudConfig = {
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
    const tableName = String(config.tableName || config.collectionName || defaultCloudConfig.tableName).trim();
    return {
      enabled: Boolean(config.enabled ?? defaultCloudConfig.enabled),
      provider: String(config.provider || defaultCloudConfig.provider).trim().toLowerCase(),
      supabaseUrl: String(config.supabaseUrl || config.url || defaultCloudConfig.supabaseUrl).trim().replace(/\/+$/, ""),
      projectRef: String(config.projectRef || defaultCloudConfig.projectRef).trim(),
      apiKey: String(config.apiKey || defaultCloudConfig.apiKey).trim(),
      tableName,
      collectionName: tableName,
      appId: String(config.appId || defaultCloudConfig.appId).trim(),
      realtime: Boolean(config.realtime ?? defaultCloudConfig.realtime),
      pollIntervalMs: Number(config.pollIntervalMs || defaultCloudConfig.pollIntervalMs)
    };
  }

  function isCloudConfigured() {
    const config = getCloudConfig();
    return Boolean(config.enabled && config.provider === "supabase" && config.supabaseUrl && config.apiKey && config.tableName && config.appId);
  }

  function getCloudStatus() {
    const config = getCloudConfig();
    return {
      enabled: config.enabled,
      configured: isCloudConfigured(),
      lastSyncAt: localStorage.getItem(CLOUD_LAST_SYNC_KEY) || "",
      lastError: localStorage.getItem(CLOUD_LAST_ERROR_KEY) || "",
      mode: localStorage.getItem(CLOUD_MODE_KEY) || "local"
    };
  }

  function notifyCloudMode(mode) {
    localStorage.setItem(CLOUD_MODE_KEY, mode);
  }

  function getSupabaseTableUrl(queryParams = null) {
    const config = getCloudConfig();
    const url = new URL(`${config.supabaseUrl}/rest/v1/${encodeURIComponent(config.tableName)}`);
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return url.toString();
  }

  function getSupabaseHeaders(prefer = "") {
    const config = getCloudConfig();
    const headers = {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    };
    if (prefer) {
      headers.Prefer = prefer;
    }
    return headers;
  }

  function serializeSupabaseData(data) {
    const normalized = normalize(data);
    return {
      app_id: getCloudConfig().appId,
      payload: normalized
    };
  }

  function parseSupabaseRows(rows) {
    if (!Array.isArray(rows) || !rows[0]?.payload) {
      return null;
    }
    return normalize(rows[0].payload);
  }

  async function supabaseRequest(method, body) {
    const config = getCloudConfig();
    const query = method === "GET"
      ? { app_id: `eq.${config.appId}`, select: "payload", limit: "1" }
      : { on_conflict: "app_id", select: "payload" };
    const response = await fetch(getSupabaseTableUrl(query), {
      method,
      headers: getSupabaseHeaders(method === "GET" ? "" : "resolution=merge-duplicates,return=representation"),
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new Error("Supabase ha rechazado la conexión. Revisa la clave anon, la tabla app_state y sus políticas RLS.");
      }
      throw new Error(text || `Error ${response.status} al contactar con Supabase.`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    return null;
  }

  function loadSupabaseSdk() {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      return Promise.resolve(window.supabase);
    }
    if (supabaseSdkPromise) {
      return supabaseSdkPromise;
    }
    supabaseSdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SUPABASE_SDK_URL;
      script.async = true;
      script.onload = () => {
        if (window.supabase && typeof window.supabase.createClient === "function") {
          resolve(window.supabase);
        } else {
          reject(new Error("El SDK de Supabase se ha cargado, pero no está disponible."));
        }
      };
      script.onerror = () => reject(new Error("No se pudo cargar Supabase Realtime. Se usará la sincronización periódica."));
      document.head.appendChild(script);
    });
    return supabaseSdkPromise;
  }

  function getSupabaseClient() {
    if (supabaseClientPromise) {
      return supabaseClientPromise;
    }
    supabaseClientPromise = loadSupabaseSdk().then((sdk) => {
      const config = getCloudConfig();
      return sdk.createClient(config.supabaseUrl, config.apiKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    });
    return supabaseClientPromise;
  }

  async function backendRequest(method, body) {
    const config = getBackendConfig();
    const response = await fetch(config.dataUrl, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Error ${response.status} al contactar con el backend.`);
    }

    return response.json();
  }

  function makeSheetsUrl(action, extraParams = {}) {
    const config = getSheetsConfig();
    const url = new URL(config.webAppUrl);
    url.searchParams.set("action", action);
    url.searchParams.set("appId", config.appId);
    Object.entries(extraParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  }

  function sheetsJsonp(action, extraParams = {}) {
    if (!isSheetsConfigured()) {
      return Promise.resolve({ ok: false, message: "Google Sheets no esta configurado." });
    }
    return new Promise((resolve, reject) => {
      const callbackName = `__abanikoSheets${Date.now()}${Math.floor(Math.random() * 100000)}`;
      const script = document.createElement("script");
      let settled = false;

      function cleanup() {
        settled = true;
        delete window[callbackName];
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      }

      const timeout = window.setTimeout(() => {
        if (!settled) {
          cleanup();
          reject(new Error("Google Sheets no respondio a tiempo."));
        }
      }, 12000);

      window[callbackName] = (payload) => {
        window.clearTimeout(timeout);
        cleanup();
        if (!payload || payload.ok === false) {
          reject(new Error(payload?.message || "Google Sheets devolvio una respuesta no valida."));
          return;
        }
        resolve(payload);
      };

      script.onerror = () => {
        window.clearTimeout(timeout);
        cleanup();
        reject(new Error("No se pudo conectar con Google Sheets."));
      };

      try {
        script.src = makeSheetsUrl(action, { ...extraParams, callback: callbackName });
        document.head.appendChild(script);
      } catch (error) {
        window.clearTimeout(timeout);
        cleanup();
        reject(error);
      }
    });
  }

  async function sheetsWriteRequest(data) {
    const config = getSheetsConfig();
    await fetch(config.webAppUrl, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        action: "write",
        appId: config.appId,
        payload: normalize(data)
      })
    });
    return normalize(data);
  }

  function save(data, options = {}) {
    const normalized = persistLocal(data);
    if (!options.skipBackend && isBackendConfigured()) {
      queueBackendPush();
    }
    if (!options.skipSheets && isSheetsConfigured()) {
      queueSheetsPush();
    }
    notifyCloudMode("local");
    if (!options.skipCloud && isCloudConfigured()) {
      queueCloudPush();
    }
    return normalized;
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportBackup() {
    downloadFile(
      "programa-abaniko-backup.json",
      JSON.stringify(load(), null, 2),
      "application/json"
    );
  }

  async function importBackupFromFile(file) {
    if (!file) {
      throw new Error("No se ha seleccionado ningún archivo.");
    }
    const text = await file.text();
    const parsed = normalize(JSON.parse(text));
    save(parsed);
    return parsed;
  }

  function findStudentIndex(data, dni) {
    return data.students.findIndex((student) => String(student.dni) === String(dni));
  }

  function getTeacherName(teacherId) {
    const teacher = getTeacherById(teacherId);
    return teacher ? teacher.name : "Sin profesor asignado";
  }

  function upsertStudent(payload, dni = null) {
    const data = load();
    const targetDni = dni || payload.dni;
    const index = findStudentIndex(data, targetDni);
    const normalizedStudent = {
      dni: payload.dni,
      createdAt: payload.createdAt || (index >= 0 ? data.students[index].createdAt : new Date().toISOString()),
      updatedAt: new Date().toISOString(),
      ...payload,
      interest: payload.interest || payload.interest === null ? payload.interest : (index >= 0 ? data.students[index].interest || {} : {}),
      sports: payload.sports || payload.sports === null ? payload.sports : (index >= 0 ? data.students[index].sports || {} : {}),
      insertion: payload.insertion || payload.insertion === null ? payload.insertion : (index >= 0 ? data.students[index].insertion || {} : {}),
      leisure: payload.leisure || payload.leisure === null ? payload.leisure : (index >= 0 ? data.students[index].leisure || {} : {}),
      interviewRecords: payload.interviewRecords || payload.interviewRecords === null ? payload.interviewRecords : (index >= 0 ? data.students[index].interviewRecords || [] : [])
    };

    if (index >= 0) {
      data.students[index] = {
        ...data.students[index],
        ...normalizedStudent
      };
    } else {
      data.students.push(normalizedStudent);
    }

    return save(data);
  }

  function patchStudentSection(dni, section, values) {
    const data = load();
    const index = findStudentIndex(data, dni);
    if (index === -1) {
      return null;
    }
    data.students[index] = {
      ...data.students[index],
      [section]: {
        ...(data.students[index][section] || {}),
        ...values
      },
      updatedAt: new Date().toISOString()
    };
    save(data);
    return data.students[index];
  }

  function getStudent(dni) {
    return load().students.find((student) => String(student.dni) === String(dni)) || null;
  }

  function getStudentFullName(student) {
    return `${student?.nombre || ""} ${student?.apellidos || ""}`.trim() || "Alumno";
  }

  function getStudentDisplayName(student) {
    const fullName = getStudentFullName(student);
    const locality = String(student?.localidad || "").trim();
    return locality ? `${fullName} - ${locality}` : fullName;
  }

  function getStudentProgramLabel(student) {
    const parts = [
      getStudentFullName(student),
      student?.fecha_nacimiento ? `Fecha: ${student.fecha_nacimiento}` : "",
      student?.discapacidad ? `Discapacidad: ${student.discapacidad}` : "",
      student?.dni ? `DNI: ${student.dni}` : ""
    ].filter(Boolean);
    return parts.join(" - ");
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function getStudentsForProgramFilter(term = "") {
    const normalizedTerm = normalizeSearchText(term);
    return getStudentsSortedByName().filter((student) => {
      if (!normalizedTerm) {
        return true;
      }
      const searchableText = normalizeSearchText([
        getStudentFullName(student),
        student?.dni,
        student?.fecha_nacimiento,
        student?.discapacidad,
        student?.localidad,
        student?.interest?.fecha,
        student?.sports?.fecha,
        student?.insertion?.fecha,
        student?.leisure?.fecha
      ].filter(Boolean).join(" "));
      return searchableText.includes(normalizedTerm);
    });
  }

  function getStudentsSortedByName() {
    return load().students
      .slice()
      .sort((a, b) => getStudentDisplayName(a).localeCompare(getStudentDisplayName(b), "es", { sensitivity: "base" }));
  }

  function getLatestInterviewRevision(record) {
    if (!record || !Array.isArray(record.revisions) || record.revisions.length === 0) {
      return null;
    }
    return record.revisions[record.revisions.length - 1];
  }

  function getStudentInterviewRecords(dni) {
    const student = getStudent(dni);
    if (!student) {
      return [];
    }
    return [...(student.interviewRecords || [])]
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  }

  function getStudentInterviewRecord(dni, recordId) {
    return getStudentInterviewRecords(dni).find((record) => String(record.id) === String(recordId)) || null;
  }

  function createStudentInterview(dni, payload) {
    const data = load();
    const index = findStudentIndex(data, dni);
    if (index === -1) {
      return { ok: false, message: "Alumno no encontrado." };
    }

    const revision = normalizeInterviewRevision(payload);
    const record = normalizeInterviewRecord({
      studentDni: dni,
      createdAt: revision.createdAt,
      updatedAt: revision.updatedAt,
      revisions: [revision]
    }, dni);

    const currentRecords = Array.isArray(data.students[index].interviewRecords)
      ? data.students[index].interviewRecords
      : [];
    data.students[index] = {
      ...data.students[index],
      interviewRecords: [...currentRecords, record],
      updatedAt: new Date().toISOString()
    };
    save(data);
    return { ok: true, record, revision };
  }

  function reviseStudentInterview(dni, recordId, payload) {
    const data = load();
    const studentIndex = findStudentIndex(data, dni);
    if (studentIndex === -1) {
      return { ok: false, message: "Alumno no encontrado." };
    }

    const records = Array.isArray(data.students[studentIndex].interviewRecords)
      ? data.students[studentIndex].interviewRecords
      : [];
    const recordIndex = records.findIndex((record) => String(record.id) === String(recordId));
    if (recordIndex === -1) {
      return { ok: false, message: "Ficha de entrevista no encontrada." };
    }

    const revision = normalizeInterviewRevision(payload);
    const record = normalizeInterviewRecord(records[recordIndex], dni);
    record.revisions.push(revision);
    record.updatedAt = revision.updatedAt;

    const nextRecords = [...records];
    nextRecords[recordIndex] = record;
    data.students[studentIndex] = {
      ...data.students[studentIndex],
      interviewRecords: nextRecords,
      updatedAt: new Date().toISOString()
    };
    save(data);
    return { ok: true, record, revision };
  }

  function removeStudent(dni) {
    const data = load();
    data.students = data.students.filter((student) => String(student.dni) !== String(dni));
    if (String(localStorage.getItem(SELECTED_STUDENT_KEY)) === String(dni)) {
      localStorage.removeItem(SELECTED_STUDENT_KEY);
    }
    if (String(localStorage.getItem(EDIT_STUDENT_KEY)) === String(dni)) {
      localStorage.removeItem(EDIT_STUDENT_KEY);
    }
    return save(data);
  }

  function getTeacherById(id) {
    return load().teachers.find((teacher) => String(teacher.id) === String(id)) || null;
  }

  function getAdminTeachers() {
    return load().teachers.filter((teacher) => teacher.role === "admin");
  }

  function getCurrentTeacherId() {
    return sessionStorage.getItem(CURRENT_TEACHER_KEY);
  }

  function getCurrentTeacher() {
    const teacherId = getCurrentTeacherId();
    if (!teacherId) {
      return null;
    }
    const teacher = getTeacherById(teacherId);
    if (!teacher) {
      sessionStorage.removeItem(CURRENT_TEACHER_KEY);
      sessionStorage.removeItem(CURRENT_ACCESS_LOG_KEY);
      return null;
    }
    return teacher;
  }

  function isCurrentTeacherAdmin() {
    return getCurrentTeacher()?.role === "admin";
  }

  function canRegisterTeachersWithoutSession() {
    return load().teachers.length === 0;
  }

  function upsertTeacher(payload, id = null) {
    const data = load();
    const currentTeacher = getCurrentTeacher();

    if (id) {
      data.teachers = data.teachers.map((teacher) => {
        if (String(teacher.id) !== String(id)) {
          return teacher;
        }
        const nextRole = payload.role || teacher.role || "profesor";
        return {
          ...teacher,
          ...payload,
          pin: payload.pin || teacher.pin || "",
          role: nextRole,
          updatedAt: new Date().toISOString()
        };
      });
    } else {
      const nextRole = payload.role || (data.teachers.length === 0 ? "admin" : "profesor");
      data.teachers.push({
        id: createId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: payload.name || "",
        subject: payload.subject || "",
        email: payload.email || "",
        phone: payload.phone || "",
        pin: payload.pin || "",
        role: nextRole
      });
    }

    const saved = save(data);
    if (currentTeacher && String(currentTeacher.id) === String(id)) {
      sessionStorage.setItem(CURRENT_TEACHER_KEY, String(id));
    }
    return saved;
  }

  function removeTeacher(id) {
    const data = load();
    const target = data.teachers.find((teacher) => String(teacher.id) === String(id));
    if (!target) {
      return { ok: false, message: "Profesor no encontrado." };
    }

    data.teachers = data.teachers.filter((teacher) => String(teacher.id) !== String(id));
    if (target.role === "admin" && !data.teachers.some((teacher) => teacher.role === "admin") && data.teachers.length > 0) {
      data.teachers[0] = {
        ...data.teachers[0],
        role: "admin",
        updatedAt: new Date().toISOString()
      };
    }
    data.sessions = data.sessions.map((session) =>
      String(session.teacherId) === String(id)
        ? { ...session, teacherId: "", teacherNameSnapshot: "Profesor eliminado", updatedAt: new Date().toISOString() }
        : session
    );
    data.accessLogs = data.accessLogs.map((log) =>
      String(log.teacherId) === String(id)
        ? { ...log, teacherDeleted: true, updatedAt: new Date().toISOString() }
        : log
    );

    if (String(sessionStorage.getItem(CURRENT_TEACHER_KEY)) === String(id)) {
      sessionStorage.removeItem(CURRENT_TEACHER_KEY);
      sessionStorage.removeItem(CURRENT_ACCESS_LOG_KEY);
    }

    save(data);
    if (target.role === "admin" && data.teachers.length > 0) {
      return { ok: true, message: `Administrador eliminado. ${data.teachers[0].name} pasa a ser el nuevo administrador.` };
    }
    return { ok: true, message: "Profesor eliminado correctamente." };
  }

  function upsertSession(payload, id = null) {
    const data = load();
    const teacherNameSnapshot = payload.teacherId ? getTeacherName(payload.teacherId) : "Sin profesor asignado";
    const sessionPayload = {
      ...payload,
      teacherNameSnapshot,
      updatedAt: new Date().toISOString()
    };

    if (id) {
      data.sessions = data.sessions.map((session) =>
        String(session.id) === String(id) ? { ...session, ...sessionPayload } : session
      );
    } else {
      data.sessions.push({
        id: createId(),
        createdAt: new Date().toISOString(),
        ...sessionPayload
      });
    }
    return save(data);
  }

  function removeSession(id) {
    const data = load();
    data.sessions = data.sessions.filter((session) => String(session.id) !== String(id));
    if (String(localStorage.getItem(SELECTED_SESSION_KEY)) === String(id)) {
      localStorage.removeItem(SELECTED_SESSION_KEY);
    }
    return save(data);
  }

  function setSelectedSession(id) {
    localStorage.setItem(SELECTED_SESSION_KEY, String(id));
  }

  function getSelectedSessionId() {
    return localStorage.getItem(SELECTED_SESSION_KEY);
  }

  function getSelectedSession() {
    const data = load();
    const selectedId = getSelectedSessionId();
    if (selectedId) {
      const selected = data.sessions.find((session) => String(session.id) === String(selectedId));
      if (selected) {
        return selected;
      }
    }
    return data.sessions[data.sessions.length - 1] || null;
  }

  function setSessionToEdit(id) {
    localStorage.setItem(EDIT_SESSION_KEY, String(id));
  }

  function getSessionToEdit() {
    return localStorage.getItem(EDIT_SESSION_KEY);
  }

  function clearSessionToEdit() {
    localStorage.removeItem(EDIT_SESSION_KEY);
  }

  function setSelectedStudent(dni) {
    localStorage.setItem(SELECTED_STUDENT_KEY, String(dni));
  }

  function getSelectedStudentDni() {
    localStorage.getItem(SELECTED_STUDENT_KEY);
    return localStorage.getItem(SELECTED_STUDENT_KEY);
  }

  function getSelectedStudent() {
    const data = load();
    const dni = getSelectedStudentDni();
    if (dni) {
      const student = data.students.find((item) => String(item.dni) === String(dni));
      if (student) {
        return student;
      }
    }
    return data.students[0] || null;
  }

  function setStudentToEdit(dni) {
    localStorage.setItem(EDIT_STUDENT_KEY, String(dni));
  }

  function getStudentToEdit() {
    return localStorage.getItem(EDIT_STUDENT_KEY);
  }

  function clearStudentToEdit() {
    localStorage.removeItem(EDIT_STUDENT_KEY);
  }

  function getCurrentAccessLogId() {
    return sessionStorage.getItem(CURRENT_ACCESS_LOG_KEY);
  }

  function loginTeacher(teacherId, pin) {
    const data = load();
    const teacher = data.teachers.find((item) => String(item.id) === String(teacherId));
    if (!teacher) {
      return { ok: false, message: "Profesor no encontrado." };
    }
    if (!teacher.pin) {
      return { ok: false, message: "Ese profesor no tiene PIN configurado." };
    }
    if (String(teacher.pin) !== String(pin)) {
      return { ok: false, message: "PIN incorrecto." };
    }

    const openLog = data.accessLogs.find(
      (log) => String(log.teacherId) === String(teacherId) && !log.logoutAt
    );

    if (openLog) {
      openLog.logoutAt = new Date().toISOString();
      openLog.updatedAt = new Date().toISOString();
    }

    const log = {
      id: createId(),
      teacherId: teacher.id,
      teacherName: teacher.name,
      teacherRole: teacher.role || "profesor",
      loginAt: new Date().toISOString(),
      logoutAt: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.accessLogs.push(log);
    save(data);
    sessionStorage.setItem(CURRENT_TEACHER_KEY, String(teacher.id));
    sessionStorage.setItem(CURRENT_ACCESS_LOG_KEY, String(log.id));
    return { ok: true, teacher, log, resumed: false, previousClosed: Boolean(openLog) };
  }

  function logoutCurrentTeacher() {
    const teacher = getCurrentTeacher();
    const logId = getCurrentAccessLogId();
    if (!teacher || !logId) {
      sessionStorage.removeItem(CURRENT_TEACHER_KEY);
      sessionStorage.removeItem(CURRENT_ACCESS_LOG_KEY);
      return null;
    }

    const data = load();
    data.accessLogs = data.accessLogs.map((log) =>
      String(log.id) === String(logId) && !log.logoutAt
        ? { ...log, logoutAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : log
    );
    save(data);
    sessionStorage.removeItem(CURRENT_TEACHER_KEY);
    sessionStorage.removeItem(CURRENT_ACCESS_LOG_KEY);
    return teacher;
  }

  function getAccessLogs() {
    return load().accessLogs
      .slice()
      .sort((a, b) => String(b.loginAt).localeCompare(String(a.loginAt)));
  }

  function getTeacherAccessLogs(teacherId) {
    return getAccessLogs().filter((log) => String(log.teacherId) === String(teacherId));
  }

  function getAbsenceTypes() {
    return ["permiso", "AP", "LR", "IT", "MAT"];
  }

  function canCurrentTeacherRegisterAbsenceFor(targetTeacherId) {
    const currentTeacher = getCurrentTeacher();
    const targetTeacher = getTeacherById(targetTeacherId);
    if (!currentTeacher || !targetTeacher) {
      return false;
    }
    return currentTeacher.role === "admin";
  }

  function registerTeacherAbsence(payload) {
    const currentTeacher = getCurrentTeacher();
    if (!currentTeacher) {
      return { ok: false, message: "Debes iniciar sesión para registrar una falta." };
    }
    if (currentTeacher.role !== "admin") {
      return { ok: false, message: "Solo un administrador puede registrar faltas del profesorado." };
    }

    const teacher = getTeacherById(payload.teacherId);
    if (!teacher) {
      return { ok: false, message: "Profesor no encontrado." };
    }

    if (!canCurrentTeacherRegisterAbsenceFor(payload.teacherId)) {
      return { ok: false, message: "No tienes permiso para registrar esa falta." };
    }

    if (!getAbsenceTypes().includes(payload.type)) {
      return { ok: false, message: "Tipo de falta no válido." };
    }

    const data = load();
    const record = {
      id: createId(),
      teacherId: teacher.id,
      teacherName: teacher.name,
      teacherRole: teacher.role || "profesor",
      type: payload.type,
      date: payload.date || new Date().toISOString().slice(0, 10),
      notes: String(payload.notes || "").trim(),
      recordedById: currentTeacher.id,
      recordedByName: currentTeacher.name,
      recordedByRole: currentTeacher.role || "profesor",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.absences.push(record);
    save(data);
    return { ok: true, record };
  }

  function getAbsences() {
    return load().absences
      .slice()
      .sort((a, b) => `${b.date || ""}${b.createdAt || ""}`.localeCompare(`${a.date || ""}${a.createdAt || ""}`));
  }

  function requireTeacherSession(redirectPage = "Index.html") {
    if (getCurrentTeacher()) {
      return true;
    }
    const currentFile = window.location.pathname.split("/").pop();
    if (currentFile !== redirectPage) {
      window.open(redirectPage, "_self");
    }
    return false;
  }

  function formatDateTime(value) {
    if (!value) {
      return "Sin registro";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function formatDate(dateValue) {
    if (!dateValue) {
      return "Sin fecha";
    }
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function formatRole(role) {
    return role === "admin" ? "Administrador" : "Profesor";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  async function pullFromCloud() {
    if (!isCloudConfigured()) {
      return { ok: false, message: "La nube no está configurada." };
    }
    if (cloudPullPromise) {
      return cloudPullPromise;
    }

    cloudPullPromise = (async () => {
      try {
        const rows = await supabaseRequest("GET");
        const remoteDocument = parseSupabaseRows(rows);
        if (!remoteDocument) {
          notifyCloudMode("cloud");
          rememberCloudSync();
          return { ok: true, updated: false, data: load() };
        }

        const remote = normalize(remoteDocument);
        const local = load();
        const shouldUseRemote = String(remote.updatedAt || "") > String(local.updatedAt || "")
          || (!hasMeaningfulData(local) && hasMeaningfulData(remote));
        if (shouldUseRemote) {
          persistLocal(remote);
          if (isBackendConfigured()) {
            queueBackendPush();
          }
          notifyCloudMode("cloud");
          rememberCloudSync();
          return { ok: true, updated: true, data: remote };
        }

        notifyCloudMode("cloud");
        rememberCloudSync();
        return { ok: true, updated: false, data: local };
      } catch (error) {
        rememberCloudError(error.message || "No se pudo descargar la información.");
        return { ok: false, message: error.message || "No se pudo descargar la información." };
      } finally {
        cloudPullPromise = null;
      }
    })();

    return cloudPullPromise;
  }

  async function testCloudConnection() {
    if (!isCloudConfigured()) {
      return { ok: false, connected: false, message: "La nube no está configurada." };
    }

    try {
      await supabaseRequest("GET");
      notifyCloudMode("cloud");
      rememberCloudSync();
      return { ok: true, connected: true, message: "Supabase disponible. La tabla app_state responde correctamente." };
    } catch (error) {
      const message = error.message || "No se pudo comprobar la conexión con la nube.";
      rememberCloudError(message);
      return { ok: false, connected: false, message };
    }
  }

  async function pullFromBackend() {
    if (!isBackendConfigured()) {
      return { ok: false, message: "El backend no está disponible." };
    }
    if (backendPullPromise) {
      return backendPullPromise;
    }

    backendPullPromise = (async () => {
      try {
        const remote = normalize(await backendRequest("GET"));
        const local = load();
        const shouldUseRemote = String(remote.updatedAt || "") >= String(local.updatedAt || "")
          || (!hasMeaningfulData(local) && hasMeaningfulData(remote));
        if (shouldUseRemote) {
          persistLocal(remote, { preserveUpdatedAt: true });
          if (isCloudConfigured() && String(remote.updatedAt || "") > String(local.updatedAt || "")) {
            queueCloudPush();
          }
          if (isSheetsConfigured() && String(remote.updatedAt || "") > String(local.updatedAt || "")) {
            queueSheetsPush();
          }
        }
        notifyBackendMode("node");
        rememberBackendSync();
        return { ok: true, data: remote };
      } catch (error) {
        rememberBackendError(error.message || "No se pudo descargar la información del backend.");
        return { ok: false, message: error.message || "No se pudo descargar la información del backend." };
      } finally {
        backendPullPromise = null;
      }
    })();

    return backendPullPromise;
  }

  async function testSheetsConnection() {
    if (!isSheetsConfigured()) {
      return { ok: false, connected: false, message: "Google Sheets no esta configurado." };
    }
    try {
      const response = await sheetsJsonp("health");
      rememberSheetsSync();
      return {
        ok: true,
        connected: true,
        message: response.message || "Google Sheets disponible."
      };
    } catch (error) {
      const message = error.message || "No se pudo comprobar Google Sheets.";
      rememberSheetsError(message);
      return { ok: false, connected: false, message };
    }
  }

  async function pullFromSheets() {
    if (!isSheetsConfigured()) {
      return { ok: false, message: "Google Sheets no esta configurado." };
    }
    if (sheetsPullPromise) {
      return sheetsPullPromise;
    }

    sheetsPullPromise = (async () => {
      try {
        const response = await sheetsJsonp("read");
        const remoteDocument = response.payload || response.data || null;
        if (!remoteDocument) {
          rememberSheetsSync();
          return { ok: true, updated: false, data: load() };
        }

        const remote = normalize(remoteDocument);
        const local = load();
        const shouldUseRemote = String(remote.updatedAt || "") > String(local.updatedAt || "")
          || (!hasMeaningfulData(local) && hasMeaningfulData(remote));
        if (shouldUseRemote) {
          persistLocal(remote, { preserveUpdatedAt: true });
          if (isBackendConfigured()) {
            queueBackendPush();
          }
          rememberSheetsSync();
          return { ok: true, updated: true, data: remote };
        }

        rememberSheetsSync();
        return { ok: true, updated: false, data: local };
      } catch (error) {
        rememberSheetsError(error.message || "No se pudo descargar la informacion de Google Sheets.");
        return { ok: false, message: error.message || "No se pudo descargar la informacion de Google Sheets." };
      } finally {
        sheetsPullPromise = null;
      }
    })();

    return sheetsPullPromise;
  }

  async function pushToSheets() {
    if (!isSheetsConfigured()) {
      return { ok: false, message: "Google Sheets no esta configurado." };
    }
    if (sheetsPushPromise) {
      return sheetsPushPromise;
    }

    sheetsPushPromise = (async () => {
      try {
        const data = load();
        await sheetsWriteRequest(data);
        rememberSheetsSync();
        return { ok: true, data };
      } catch (error) {
        rememberSheetsError(error.message || "No se pudo guardar la informacion en Google Sheets.");
        return { ok: false, message: error.message || "No se pudo guardar la informacion en Google Sheets." };
      } finally {
        sheetsPushPromise = null;
      }
    })();

    return sheetsPushPromise;
  }

  function queueSheetsPush() {
    pushToSheets().catch((error) => {
      rememberSheetsError(error.message || "No se pudo sincronizar Google Sheets.");
    });
  }

  async function syncSheetsNow() {
    const pulled = await pullFromSheets();
    if (!pulled.ok) {
      return pulled;
    }
    const pushed = await pushToSheets();
    if (!pushed.ok) {
      return pushed;
    }
    return { ok: true, message: "Google Sheets sincronizado correctamente." };
  }

  async function pushToBackend() {
    if (!isBackendConfigured()) {
      return { ok: false, message: "El backend no está disponible." };
    }
    if (backendPushPromise) {
      return backendPushPromise;
    }

    backendPushPromise = (async () => {
      try {
        const data = load();
        const saved = await backendRequest("PUT", data);
        persistLocal(saved, { preserveUpdatedAt: true });
        notifyBackendMode("node");
        rememberBackendSync();
        return { ok: true, data: saved };
      } catch (error) {
        rememberBackendError(error.message || "No se pudo guardar la información en el backend.");
        return { ok: false, message: error.message || "No se pudo guardar la información en el backend." };
      } finally {
        backendPushPromise = null;
      }
    })();

    return backendPushPromise;
  }

  function queueBackendPush() {
    pushToBackend().catch((error) => {
      rememberBackendError(error.message || "No se pudo sincronizar el backend.");
    });
  }

  async function syncBackendNow() {
    const targets = [];
    if (isBackendConfigured()) {
      targets.push("node");
    }
    if (isSheetsConfigured()) {
      targets.push("sheets");
    }
    if (targets.length === 0) {
      return { ok: false, message: "No hay ningun backend configurado." };
    }

    if (isBackendConfigured()) {
      const pulled = await pullFromBackend();
      if (!pulled.ok) return pulled;
      const pushed = await pushToBackend();
      if (!pushed.ok) return pushed;
    }

    if (isSheetsConfigured()) {
      const sheets = await syncSheetsNow();
      if (!sheets.ok) return sheets;
    }

    return { ok: true, message: "Backend sincronizado correctamente." };
  }

  function startBackendAutoSync(onUpdate) {
    const intervals = [];
    if (isBackendConfigured()) {
      pullFromBackend().finally(() => {
        if (typeof onUpdate === "function") {
          onUpdate(getBackendStatus());
        }
      });
      intervals.push(window.setInterval(async () => {
        await pullFromBackend();
        if (typeof onUpdate === "function") {
          onUpdate(getBackendStatus());
        }
      }, 15000));
    }
    if (isSheetsConfigured()) {
      pullFromSheets().finally(() => {
        if (typeof onUpdate === "function") {
          onUpdate(getSheetsStatus());
        }
      });
      intervals.push(window.setInterval(async () => {
        await pullFromSheets();
        if (typeof onUpdate === "function") {
          onUpdate(getSheetsStatus());
        }
      }, Math.max(15000, getSheetsConfig().pollIntervalMs)));
    }
    return intervals.length ? intervals : null;
  }

  async function pushToCloud() {
    if (!isCloudConfigured()) {
      return { ok: false, message: "La nube no está configurada." };
    }
    if (cloudPushPromise) {
      return cloudPushPromise;
    }

    cloudPushPromise = (async () => {
      try {
        const data = load();
        const document = await supabaseRequest("POST", serializeSupabaseData(data));
        notifyCloudMode("cloud");
        rememberCloudSync();
        return { ok: true, document };
      } catch (error) {
        rememberCloudError(error.message || "No se pudo subir la información.");
        return { ok: false, message: error.message || "No se pudo subir la información." };
      } finally {
        cloudPushPromise = null;
      }
    })();

    return cloudPushPromise;
  }

  function queueCloudPush() {
    pushToCloud().catch((error) => {
      rememberCloudError(error.message || "No se pudo sincronizar la nube.");
    });
  }

  async function syncCloudNow() {
    const pulled = await pullFromCloud();
    if (!pulled.ok) {
      return pulled;
    }
    const pushed = await pushToCloud();
    if (!pushed.ok) {
      return pushed;
    }
    return { ok: true, message: "Sincronización completada." };
  }

  function startSupabaseRealtimeSync(onUpdate) {
    const config = getCloudConfig();
    if (!config.realtime || config.provider !== "supabase") {
      return;
    }

    getSupabaseClient()
      .then((client) => {
        client
          .channel(`abaniko-${config.appId}-${Date.now()}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: config.tableName,
              filter: `app_id=eq.${config.appId}`
            },
            async () => {
              await pullFromCloud();
              if (typeof onUpdate === "function") {
                onUpdate(getCloudStatus());
              }
            }
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              rememberCloudError("");
            }
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              rememberCloudError("Supabase Realtime no respondió. Se mantiene la sincronización periódica.");
            }
            if (typeof onUpdate === "function") {
              onUpdate(getCloudStatus());
            }
          });
      })
      .catch((error) => {
        rememberCloudError(error.message || "No se pudo iniciar Supabase Realtime.");
        if (typeof onUpdate === "function") {
          onUpdate(getCloudStatus());
        }
      });
  }

  function startCloudAutoSync(onUpdate) {
    if (!isCloudConfigured()) {
      return null;
    }
    const config = getCloudConfig();
    pullFromCloud().finally(() => {
      if (typeof onUpdate === "function") {
        onUpdate(getCloudStatus());
      }
    });
    startSupabaseRealtimeSync(onUpdate);
    return window.setInterval(async () => {
      await pullFromCloud();
      if (typeof onUpdate === "function") {
        onUpdate(getCloudStatus());
      }
    }, Math.max(15000, config.pollIntervalMs));
  }

  return {
    STORAGE_KEY,
    load,
    save,
    exportBackup,
    importBackupFromFile,
    getBackendConfig,
    getBackendStatus,
    isBackendConfigured,
    pullFromBackend,
    pushToBackend,
    syncBackendNow,
    startBackendAutoSync,
    getSheetsConfig,
    getSheetsStatus,
    setSheetsConnection,
    clearSheetsConnection,
    isSheetsConfigured,
    testSheetsConnection,
    pullFromSheets,
    pushToSheets,
    syncSheetsNow,
    getCloudConfig,
    getCloudStatus,
    isCloudConfigured,
    testCloudConnection,
    pullFromCloud,
    pushToCloud,
    syncCloudNow,
    startCloudAutoSync,
    upsertTeacher,
    removeTeacher,
    upsertSession,
    removeSession,
    setSelectedSession,
    getSelectedSession,
    getSelectedSessionId,
    setSessionToEdit,
    getSessionToEdit,
    clearSessionToEdit,
    upsertStudent,
    patchStudentSection,
    getStudent,
    getStudentFullName,
    getStudentDisplayName,
    getStudentProgramLabel,
    getStudentsSortedByName,
    getStudentsForProgramFilter,
    getStudentInterviewRecords,
    getStudentInterviewRecord,
    getLatestInterviewRevision,
    createStudentInterview,
    reviseStudentInterview,
    removeStudent,
    setSelectedStudent,
    getSelectedStudent,
    getSelectedStudentDni,
    setStudentToEdit,
    getStudentToEdit,
    clearStudentToEdit,
    getTeacherById,
    getCurrentTeacher,
    getCurrentTeacherId,
    getAdminTeachers,
    isCurrentTeacherAdmin,
    canRegisterTeachersWithoutSession,
    loginTeacher,
    logoutCurrentTeacher,
    getAccessLogs,
    getTeacherAccessLogs,
    getAbsenceTypes,
    canCurrentTeacherRegisterAbsenceFor,
    registerTeacherAbsence,
    getAbsences,
    requireTeacherSession,
    getTeacherName,
    formatDate,
    formatDateTime,
    formatRole,
    escapeHtml
  };
})();
