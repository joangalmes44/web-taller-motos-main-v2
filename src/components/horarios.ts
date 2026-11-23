// Los horarios del taller, en un solo lugar: el pie, la portada y cualquier pantalla los leen de acá.
export const HORARIOS = [
  { dia: 'Lun–Vie', horas: 'Lun–Vie 11:00 a 20:00 hs', desde: '11:00', hasta: '20:00', abierto: true },
  { dia: 'Sáb', horas: 'Sáb 11:00 a 16:00 hs', desde: '11:00', hasta: '16:00', abierto: true },
  { dia: 'Dom', horas: 'Dom cerrado', desde: '', hasta: '', abierto: false },
] as const;
