export const state = {
    databases: [],
    currentDb: null,
    sessions: {}, // keyed by db.id
    editingDbId: null,
    activeGroup: '', // '' = All
}
