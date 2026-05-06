const AbanikoStore = (() => {
  const STORAGE_KEY = "programaAbanikoData";
  const SELECTED_SESSION_KEY = "programaAbanikoSelectedSessionId";
  const EDIT_SESSION_KEY = "programaAbanikoEditSessionId";
  const SELECTED_STUDENT_KEY = "programaAbanikoSelectedStudentDni";
  const EDIT_STUDENT_KEY = "programaAbanikoEditStudentDni";

  function normalize(data) {
    return {
      students: Array.isArray(data?.students) ? data.students : [],
      teachers: Array.isArray(data?.teachers) ? data.teachers : [],
      sessions: Array.isArray(data?.sessions) ? data.sessions : [],
      updatedAt: data?.updatedAt || new Date().toISOString()
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const initial = normalize({});
        save(initial);
        return initial;
      }
      return normalize(JSON.parse(raw));
    } catch (error) {
      console.error("No se pudo cargar la informacion:", error);
      return normalize({});
    }
  }

  function save(data) {
    const normalized = normalize(data);
    normalized.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function createId() {
    return Date.now() + Math.floor(Math.random() * 100000);
  }

  function getTeacherName(teacherId) {
    const data = load();
    const teacher = data.teachers.find((item) => String(item.id) === String(teacherId));
    return teacher ? teacher.name : "Sin profesor asignado";
  }

  function findStudentIndex(data, dni) {
    return data.students.findIndex((student) => String(student.dni) === String(dni));
  }

  function upsertStudent(payload, dni = null) {
    const data = load();
    const targetDni = dni || payload.dni;
    const index = findStudentIndex(data, targetDni);
    const normalizedStudent = {
      dni: payload.dni,
      createdAt: payload.createdAt || new Date().toISOString(),
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

  function upsertTeacher(payload, id = null) {
    const data = load();
    if (id) {
      data.teachers = data.teachers.map((teacher) =>
        String(teacher.id) === String(id) ? { ...teacher, ...payload } : teacher
      );
    } else {
      data.teachers.push({
        id: createId(),
        createdAt: new Date().toISOString(),
        ...payload
      });
    }
    return save(data);
  }

  function removeTeacher(id) {
    const data = load();
    data.teachers = data.teachers.filter((teacher) => String(teacher.id) !== String(id));
    data.sessions = data.sessions.map((session) =>
      String(session.teacherId) === String(id)
        ? { ...session, teacherId: "", teacherNameSnapshot: "Profesor eliminado" }
        : session
    );
    return save(data);
  }

  function upsertSession(payload, id = null) {
    const data = load();
    const teacherNameSnapshot = payload.teacherId ? getTeacherName(payload.teacherId) : "Sin profesor asignado";
    const sessionPayload = { ...payload, teacherNameSnapshot };

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

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  return {
    STORAGE_KEY,
    load,
    save,
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
    getTeacherName,
    formatDate,
    escapeHtml
  };
})();
