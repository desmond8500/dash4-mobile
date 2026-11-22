import { EQUIPMENT_STATUSES, type Characteristic, type Equipment, type EquipmentPayload, type EquipmentStatus, type Site } from '@dash4/shared'

/** Fiche d'un équipement en cours de saisie sur le téléphone. */
export interface EquipmentForm {
  systemId: number | null
  parentId: number | null
  articleId: number | null
  /** Emplacement : `level:ID` ou `room:ID` (vide : non placé). */
  place: string
  name: string
  type: string
  model: string
  serialNumber: string
  quantity: number | string
  status: EquipmentStatus
  characteristics: Characteristic[]
  description: string
}

export function newEquipmentForm(systemId: number | null): EquipmentForm {
  return {
    systemId,
    parentId: null,
    articleId: null,
    place: '',
    name: '',
    type: '',
    model: '',
    serialNumber: '',
    quantity: 1,
    status: 'planned',
    characteristics: [],
    description: '',
  }
}

export function equipmentToForm(e: Equipment): EquipmentForm {
  return {
    systemId: e.installed_system_id,
    parentId: e.parent_id,
    articleId: e.article_id,
    place: e.room_id ? `room:${e.room_id}` : e.level_id ? `level:${e.level_id}` : '',
    name: e.name,
    type: e.type ?? '',
    model: e.model ?? '',
    serialNumber: e.serial_number ?? '',
    quantity: e.quantity,
    status: e.status.value,
    characteristics: e.characteristics.map((c) => ({ ...c })),
    description: e.description ?? '',
  }
}

/** Copie pour en saisir un autre du même modèle : sans n° de série, ni valeurs propres à l'appareil. */
export function duplicateForm(form: EquipmentForm): EquipmentForm {
  return { ...form, serialNumber: '', characteristics: form.characteristics.map((c) => ({ label: c.label, value: '' })) }
}

/** Emplacements du chantier : niveaux et pièces, avec le chemin complet. */
export function placeOptions(site: Pick<Site, 'buildings'>): Array<{ value: string; label: string; levelId: number; roomId: number | null }> {
  const options: Array<{ value: string; label: string; levelId: number; roomId: number | null }> = []
  for (const b of site.buildings) {
    for (const l of b.levels) {
      options.push({ value: `level:${l.id}`, label: `${b.name} › ${l.name}`, levelId: l.id, roomId: null })
      for (const r of l.rooms) options.push({ value: `room:${r.id}`, label: `${b.name} › ${l.name} › ${r.name}`, levelId: l.id, roomId: r.id })
    }
  }
  return options
}

/** Équipements pouvant en contenir un autre : les principaux du système, sauf lui-même. */
export function parentOptions(site: Pick<Site, 'systems'>, systemId: number | null, excludeId: number | null = null): Equipment[] {
  const system = site.systems.find((s) => s.id === systemId)
  return (system?.equipment ?? []).filter((e) => !e.parent_id && e.id !== excludeId && e.id > 0)
}

/** Contrôle et prépare l'envoi ; renvoie un message en français si la fiche est incomplète. */
export function buildEquipmentPayload(
  form: EquipmentForm,
  site: Pick<Site, 'buildings'>,
): { payload?: EquipmentPayload & { installed_system_id: number }; error?: string } {
  if (!form.systemId) return { error: 'Choisissez le système.' }
  if (!form.name.trim() && !form.articleId) return { error: "Donnez un nom à l'équipement ou choisissez un article." }
  const quantity = Math.round(Number(form.quantity))
  if (!Number.isFinite(quantity) || quantity < 1) return { error: 'La quantité doit être au moins 1.' }
  const labels = form.characteristics.filter((c) => c.label.trim() || c.value.trim())
  if (labels.some((c) => !c.label.trim())) return { error: 'Chaque caractéristique a besoin d’un libellé.' }

  const place = placeOptions(site).find((p) => p.value === form.place)
  const text = (v: string) => v.trim() || null
  return {
    payload: {
      installed_system_id: form.systemId,
      parent_id: form.parentId,
      article_id: form.articleId,
      level_id: place?.levelId ?? null,
      room_id: place?.roomId ?? null,
      name: text(form.name),
      type: text(form.type),
      model: text(form.model),
      serial_number: text(form.serialNumber),
      quantity,
      status: form.status,
      characteristics: labels.map((c) => ({ label: c.label.trim(), value: c.value.trim() })),
      description: text(form.description),
    },
  }
}

/** Ajoute ou remplace l'équipement dans le chantier gardé sur le téléphone (affiché tout de suite). */
export function applyEquipment(site: Site, payload: EquipmentPayload & { installed_system_id: number }, existing: Equipment | null, tempId: number, article: { id: number; designation: string; reference: string | null } | null = null): Site {
  const status = payload.status ?? existing?.status.value ?? 'planned'
  const item: Equipment = {
    ...(existing ?? { id: tempId, client_uuid: null, position: 0, updated_at: null }),
    installed_system_id: payload.installed_system_id,
    parent_id: payload.parent_id ?? null,
    article_id: payload.article_id ?? null,
    article: article ?? (payload.article_id && existing?.article?.id === payload.article_id ? existing.article : null),
    level_id: payload.level_id ?? null,
    room_id: payload.room_id ?? null,
    name: payload.name ?? article?.designation ?? existing?.name ?? '',
    type: payload.type ?? null,
    model: payload.model ?? null,
    serial_number: payload.serial_number ?? null,
    quantity: payload.quantity ?? 1,
    status: { value: status, label: EQUIPMENT_STATUSES.find((s) => s.value === status)?.label ?? status },
    characteristics: payload.characteristics ?? [],
    description: payload.description ?? null,
  } as Equipment
  const movedChildren = existing ? new Set(site.systems.flatMap((s) => s.equipment ?? []).filter((e) => e.parent_id === existing.id).map((e) => e.id)) : new Set<number>()
  const children = site.systems.flatMap((s) => s.equipment ?? []).filter((e) => movedChildren.has(e.id)).map((e) => ({ ...e, installed_system_id: item.installed_system_id }))
  const systems = site.systems.map((s) => {
    const kept = (s.equipment ?? []).filter((e) => e.id !== item.id && !movedChildren.has(e.id))
    if (s.id !== item.installed_system_id) return { ...s, equipment: kept }
    if (existing && existing.installed_system_id === s.id) {
      const list = (s.equipment ?? []).map((e) => (e.id === item.id ? item : e))
      return { ...s, equipment: list }
    }
    return { ...s, equipment: [...kept, item, ...children] }
  })
  return { ...site, systems, equipment_count: countUnits(systems) }
}

/** Retire l'équipement et ses sous-équipements du chantier gardé sur le téléphone. */
export function removeEquipment(site: Site, id: number): Site {
  const systems = site.systems.map((s) => ({ ...s, equipment: (s.equipment ?? []).filter((e) => e.id !== id && e.parent_id !== id) }))
  return { ...site, systems, equipment_count: countUnits(systems) }
}

/** Nombre d'appareils du chantier, comme l'API : somme des quantités. */
export function countUnits(systems: Site['systems']): number {
  return systems.reduce((n, s) => n + (s.equipment ?? []).reduce((m, e) => m + e.quantity, 0), 0)
}
