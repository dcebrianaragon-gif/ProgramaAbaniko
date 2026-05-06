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

  let cloudPullPromise = null;
  let cloudPushPromise = null;
  let backendPullPromise = null;
  let backendPushPromise = null;

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

  function normalize(data) {
    const teachers = Array.isArray(data?.teachers) ? data.teachers : [];
    return {
      students: Array.isArray(data?.students) ? data.students : [],
      teachers: teachers.map((teacher, index) => normalizeTeacher(teacher, index)),
      sessions: Array.isArray(data?.sessions) ? data.sessions : [],
      accessLogs: Array.isArray(data?.accessLogs) ? data.accessLogs : [],
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
    return {
      enabled: typeof window !== "undefined" && /^https?:$/i.test(window.location.protocol),
      dataUrl: typeof window !== "undefined" ? `${window.location.origin}/api/data` : "",
      healthUrl: typeof window !== "undefined" ? `${window.location.origin}/api/health` : ""
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

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const remote = loadFromBackendSync();
        return remote || persistLocal({});
      }
      return normalize(JSON.parse(raw));
    } catch (error) {
      console.error("No se pudo cargar la informacion:", error);
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
    return {
      enabled: Boolean(config.enabled),
      projectUrl: String(config.projectUrl || "").replace(/\/+$/, ""),
      anonKey: String(config.anonKey || "").trim(),
      tableName: String(config.tableName || "app_state").trim(),
      appId: String(config.appId || "programa-abaniko").trim(),
      pollIntervalMs: Number(config.pollIntervalMs || 30000)
    };
  }

  function isCloudConfigured() {
    const config = getCloudConfig();
    return Boolean(config.enabled && config.projectUrl && config.anonKey && config.tableName && config.appId);
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

  async function cloudRequest(method, path, body) {
    const config = getCloudConfig();
    const response = await fetch(`${config.projectUrl}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation,resolution=merge-duplicates"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 404) {
        throw new Error("La tabla remota app_state no existe todavia. Ejecuta primero supabase-setup.sql en tu proyecto.");
      }
      throw new Error(text || `Error ${response.status} al contactar con la nube.`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    return null;
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

  function save(data, options = {}) {
    const normalized = persistLocal(data);
    if (!options.skipBackend && isBackendConfigured()) {
      queueBackendPush();
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
      throw new Error("No se ha seleccionado ningun archivo.");
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
      leisure: payload.leisure || payload.leisure === null ? payload.leisure : (index >= 0 ? data.students[index].leisure || {} : {})
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
    if (target.role === "admin" && getAdminTeachers().length <= 1) {
      return { ok: false, message: "Debe quedar al menos un profesor administrador." };
    }

    data.teachers = data.teachers.filter((teacher) => String(teacher.id) !== String(id));
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
      return { ok: false, message: "La nube no esta configurada." };
    }
    if (cloudPullPromise) {
      return cloudPullPromise;
    }

    cloudPullPromise = (async () => {
      try {
        const config = getCloudConfig();
        const rows = await cloudRequest(
          "GET",
          `${config.tableName}?app_id=eq.${encodeURIComponent(config.appId)}&select=*`
        );
        if (!Array.isArray(rows) || rows.length === 0 || !rows[0].payload) {
          notifyCloudMode("cloud");
          rememberCloudSync();
          return { ok: true, updated: false, data: load() };
        }

        const remote = normalize(rows[0].payload);
        const local = load();
        if (String(remote.updatedAt || "") > String(local.updatedAt || "")) {
          persistLocal(remote);
          notifyCloudMode("cloud");
          rememberCloudSync();
          return { ok: true, updated: true, data: remote };
        }

        notifyCloudMode("cloud");
        rememberCloudSync();
        return { ok: true, updated: false, data: local };
      } catch (error) {
        rememberCloudError(error.message || "No se pudo descargar la informacion.");
        return { ok: false, message: error.message || "No se pudo descargar la informacion." };
      } finally {
        cloudPullPromise = null;
      }
    })();

    return cloudPullPromise;
  }

  async function pullFromBackend() {
    if (!isBackendConfigured()) {
      return { ok: false, message: "El backend no esta disponible." };
    }
    if (backendPullPromise) {
      return backendPullPromise;
    }

    backendPullPromise = (async () => {
      try {
        const remote = normalize(await backendRequest("GET"));
        const local = load();
        if (String(remote.updatedAt || "") >= String(local.updatedAt || "")) {
          persistLocal(remote, { preserveUpdatedAt: true });
        }
        notifyBackendMode("node");
        rememberBackendSync();
        return { ok: true, data: remote };
      } catch (error) {
        rememberBackendError(error.message || "No se pudo descargar la informacion del backend.");
        return { ok: false, message: error.message || "No se pudo descargar la informacion del backend." };
      } finally {
        backendPullPromise = null;
      }
    })();

    return backendPullPromise;
  }

  async function pushToBackend() {
    if (!isBackendConfigured()) {
      return { ok: false, message: "El backend no esta disponible." };
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
        rememberBackendError(error.message || "No se pudo guardar la informacion en el backend.");
        return { ok: false, message: error.message || "No se pudo guardar la informacion en el backend." };
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
    const pulled = await pullFromBackend();
    if (!pulled.ok) {
      return pulled;
    }
    const pushed = await pushToBackend();
    if (!pushed.ok) {
      return pushed;
    }
    return { ok: true, message: "Backend sincronizado correctamente." };
  }

  function startBackendAutoSync(onUpdate) {
    if (!isBackendConfigured()) {
      return null;
    }
    pullFromBackend().finally(() => {
      if (typeof onUpdate === "function") {
        onUpdate(getBackendStatus());
      }
    });
    return window.setInterval(async () => {
      await pullFromBackend();
      if (typeof onUpdate === "function") {
        onUpdate(getBackendStatus());
      }
    }, 15000);
  }

  async function pushToCloud() {
    if (!isCloudConfigured()) {
      return { ok: false, message: "La nube no esta configurada." };
    }
    if (cloudPushPromise) {
      return cloudPushPromise;
    }

    cloudPushPromise = (async () => {
      try {
        const config = getCloudConfig();
        const data = load();
        const body = [{
          app_id: config.appId,
          payload: data,
          updated_at: data.updatedAt
        }];
        const rows = await cloudRequest("POST", config.tableName, body);
        notifyCloudMode("cloud");
        rememberCloudSync();
        return { ok: true, rows };
      } catch (error) {
        rememberCloudError(error.message || "No se pudo subir la informacion.");
        return { ok: false, message: error.message || "No se pudo subir la informacion." };
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
    return { ok: true, message: "Sincronizacion completada." };
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
    getCloudConfig,
    getCloudStatus,
    isCloudConfigured,
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
    requireTeacherSession,
    getTeacherName,
    formatDate,
    formatDateTime,
    formatRole,
    escapeHtml
  };
})();
