import { describe, expect, it } from 'vitest'
import type { Equipment, Site } from '@dash4/shared'
import { applyEquipment, buildEquipmentPayload, duplicateForm, equipmentToForm, newEquipmentForm, parentOptions, placeOptions, removeEquipment } from '../src/utils/equipment'

const eq = (id: number, systemId: number, extra: Partial<Equipment> = {}): Equipment =>
  ({
    id,
    client_uuid: null,
    installed_system_id: systemId,
    parent_id: null,
    name: `Équipement ${id}`,
    type: null,
    model: null,
    serial_number: null,
    quantity: 1,
    status: { value: 'planned', label: 'Prévu' },
    characteristics: [],
    description: null,
    position: 0,
    article_id: null,
    level_id: null,
    room_id: null,
    updated_at: null,
    ...extra,
  }) as Equipment

const site = (): Site =>
  ({
    project: { id: 1, name: 'Tour' },
    buildings: [{ id: 1, name: 'Bât A', description: null, position: 0, levels: [{ id: 10, name: 'RDC', description: null, position: 0, rooms: [{ id: 100, name: 'Hall', description: null, position: 0 }] }] }],
    systems: [
      { id: 1, project_id: 1, name: 'Vidéo', equipment: [eq(1, 1, { name: 'NVR' }), eq(2, 1, { parent_id: 1, name: 'Disque' }), eq(3, 1)] },
      { id: 2, project_id: 1, name: 'Alarme', equipment: [] },
    ],
    progress: 0,
    equipment_count: 3,
    reception_reports_count: 0,
    can: { manage: true, create: true, delete: true },
    updated_at: null,
  }) as unknown as Site

describe('équipements du chantier sur le téléphone', () => {
  it('liste les emplacements et les équipements principaux', () => {
    expect(placeOptions(site()).map((p) => p.label)).toEqual(['Bât A › RDC', 'Bât A › RDC › Hall'])
    expect(parentOptions(site(), 1, 3).map((e) => e.name)).toEqual(['NVR'])
    expect(parentOptions(site(), 1, 1).map((e) => e.id)).toEqual([3])
  })

  it('contrôle la fiche et prépare l’envoi', () => {
    const form = { ...newEquipmentForm(1), name: ' Caméra hall ', place: 'room:100', quantity: '2', characteristics: [{ label: 'Adresse IP', value: ' 192.168.1.20 ' }, { label: '', value: '' }] }
    expect(buildEquipmentPayload(form, site()).payload).toMatchObject({
      installed_system_id: 1,
      name: 'Caméra hall',
      level_id: 10,
      room_id: 100,
      quantity: 2,
      characteristics: [{ label: 'Adresse IP', value: '192.168.1.20' }],
      serial_number: null,
    })
    expect(buildEquipmentPayload(newEquipmentForm(null), site()).error).toBe('Choisissez le système.')
    expect(buildEquipmentPayload(newEquipmentForm(1), site()).error).toBe("Donnez un nom à l'équipement ou choisissez un article.")
    expect(buildEquipmentPayload({ ...newEquipmentForm(1), articleId: 4 }, site()).payload?.name).toBeNull()
    expect(buildEquipmentPayload({ ...newEquipmentForm(1), name: 'X', quantity: 0 }, site()).error).toBe('La quantité doit être au moins 1.')
    expect(buildEquipmentPayload({ ...newEquipmentForm(1), name: 'X', characteristics: [{ label: ' ', value: 'abc' }] }, site()).error).toBe('Chaque caractéristique a besoin d’un libellé.')
  })

  it('reprend une fiche existante et la duplique sans n° de série', () => {
    const form = equipmentToForm(eq(5, 1, { room_id: 100, level_id: 10, serial_number: 'SN1', characteristics: [{ label: 'Adresse IP', value: '10.0.0.5' }] }))
    expect(form.place).toBe('room:100')
    expect(duplicateForm(form)).toMatchObject({ serialNumber: '', place: 'room:100', characteristics: [{ label: 'Adresse IP', value: '' }] })
  })

  it('affiche tout de suite un ajout, une modification et une suppression', () => {
    const payload = buildEquipmentPayload({ ...newEquipmentForm(2), name: 'Sirène', status: 'installed' }, site()).payload!
    const added = applyEquipment(site(), payload, null, -7)
    expect(added.systems[1]!.equipment!.map((e) => [e.id, e.name, e.status.label])).toEqual([[-7, 'Sirène', 'Posé']])
    expect(added.equipment_count).toBe(4)

    // Le NVR change de système : son disque le suit
    const nvr = site().systems[0]!.equipment![0]!
    const moved = applyEquipment(site(), { ...buildEquipmentPayload(equipmentToForm(nvr), site()).payload!, installed_system_id: 2 }, nvr, -1)
    expect(moved.systems[0]!.equipment!.map((e) => e.id)).toEqual([3])
    expect(moved.systems[1]!.equipment!.map((e) => [e.id, e.installed_system_id])).toEqual([[1, 2], [2, 2]])

    const renamed = applyEquipment(site(), buildEquipmentPayload({ ...equipmentToForm(nvr), name: 'NVR 16 voies' }, site()).payload!, nvr, -1)
    expect(renamed.systems[0]!.equipment!.map((e) => e.name)).toEqual(['NVR 16 voies', 'Disque', 'Équipement 3'])

    expect(removeEquipment(site(), 1).systems[0]!.equipment!.map((e) => e.id)).toEqual([3])
  })
})
