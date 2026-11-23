export type Rol = 'cliente' | 'mecanico' | 'recepcion' | 'administracion';
export type OrdenEstado = 'Recibida' | 'En diagnóstico' | 'Esperando aprobación' | 'Esperando repuesto' | 'En reparación' | 'Prueba de ruta' | 'Lista para retirar' | 'Entregada' | 'Garantía' | 'Anulada';
export type CompraEstado = 'Borrador' | 'Enviada' | 'Recibida parcial' | 'Recibida' | 'Anulada';

export const ROLES: readonly Rol[] = ['cliente','mecanico','recepcion','administracion'];
export const ORDEN_ESTADOS: readonly OrdenEstado[] = ['Recibida','En diagnóstico','Esperando aprobación','Esperando repuesto','En reparación','Prueba de ruta','Lista para retirar','Entregada','Garantía','Anulada'];
export const COMPRA_ESTADOS: readonly CompraEstado[] = ['Borrador','Enviada','Recibida parcial','Recibida','Anulada'];

function table(name: string, columns: Record<string,string>) { const t: any = { tableName:name, name }; for (const [key,column] of Object.entries(columns)) t[key]={table:name,column,key}; return t as any; }

export const perfiles=table('perfiles',{userId:'user_id',rol:'rol',nombre:'nombre',telefono:'telefono',creadoEn:'creado_en'});
export const puestos=table('puestos',{id:'id',numero:'numero',nombre:'nombre',descripcion:'descripcion',equipado:'equipado'});
export const servicios=table('servicios',{id:'id',nombre:'nombre',descripcion:'descripcion',soloPuestoEquipado:'solo_puesto_equipado',nota:'nota',orden:'orden'});
export const servicioTarifas=table('servicio_tarifas',{id:'id',servicioId:'servicio_id',rango:'rango',duracionMin:'duracion_min',precioClp:'precio_clp'});
export const mecanicos=table('mecanicos',{id:'id',userId:'user_id',nombre:'nombre',comisionPct:'comision_pct',especialidad:'especialidad'});
export const proveedores=table('proveedores',{id:'id',nombre:'nombre',rubro:'rubro',contacto:'contacto',telefono:'telefono',plazoDias:'plazo_dias'});
export const repuestos=table('repuestos',{id:'id',sku:'sku',nombre:'nombre',compatibilidad:'compatibilidad',costoClp:'costo_clp',precioClp:'precio_clp',stockMinimo:'stock_minimo',especial:'especial',proveedorId:'proveedor_id'});
export const movimientosStock=table('movimientos_stock',{id:'id',repuestoId:'repuesto_id',tipo:'tipo',cantidad:'cantidad',nota:'nota',ordenId:'orden_id',compraId:'compra_id',operationId:'operation_id',creadoEn:'creado_en'});
export const motos=table('motos',{id:'id',userId:'user_id',patente:'patente',marca:'marca',modelo:'modelo',cc:'cc',kmActual:'km_actual',creadoEn:'creado_en'});
export const motoKm=table('moto_km',{id:'id',motoId:'moto_id',km:'km',fuente:'fuente',creadoEn:'creado_en'});
export const reservas=table('reservas',{id:'id',operationId:'operation_id',userId:'user_id',motoId:'moto_id',servicioId:'servicio_id',puestoId:'puesto_id',inicio:'inicio',fin:'fin',duracionMin:'duracion_min',precioClp:'precio_clp',estado:'estado',abonoRequeridoClp:'abono_requerido_clp',abonoPagadoClp:'abono_pagado_clp',reprogramadaDe:'reprogramada_de',creadoEn:'creado_en'});
export const ordenes=table('ordenes',{id:'id',operationId:'operation_id',numero:'numero',reservaId:'reserva_id',userId:'user_id',motoId:'moto_id',servicioId:'servicio_id',puestoId:'puesto_id',mecanicoId:'mecanico_id',origen:'origen',estado:'estado',kmIngreso:'km_ingreso',combustible:'combustible',danos:'danos',notas:'notas',manoObraClp:'mano_obra_clp',extraMin:'extra_min',inicioPlan:'inicio_plan',finPlan:'fin_plan',entregaEstimada:'entrega_estimada',entregaMovida:'entrega_movida',listaEn:'lista_en',entregadaEn:'entregada_en',estadoAntesRepuesto:'estado_antes_repuesto',creadoEn:'creado_en',actualizadoEn:'actualizado_en'});
export const ordenHistorial=table('orden_historial',{id:'id',ordenId:'orden_id',estado:'estado',nota:'nota',autor:'autor',creadoEn:'creado_en'});
export const adicionales=table('adicionales',{id:'id',ordenId:'orden_id',mecanicoId:'mecanico_id',descripcion:'descripcion',manoObraClp:'mano_obra_clp',tiempoExtraMin:'tiempo_extra_min',estado:'estado',estadoAntes:'estado_antes',propuestoEn:'propuesto_en',venceEn:'vence_en',respondidoEn:'respondido_en',respuestaOp:'respuesta_op',operationId:'operation_id'});
export const adicionalRepuestos=table('adicional_repuestos',{id:'id',adicionalId:'adicional_id',repuestoId:'repuesto_id',cantidad:'cantidad',precioClp:'precio_clp'});
export const ordenRepuestos=table('orden_repuestos',{id:'id',ordenId:'orden_id',repuestoId:'repuesto_id',adicionalId:'adicional_id',cantidad:'cantidad',precioClp:'precio_clp',estado:'estado',creadoEn:'creado_en'});
export const abonos=table('abonos',{id:'id',ordenId:'orden_id',ordenRepuestoId:'orden_repuesto_id',concepto:'concepto',requeridoClp:'requerido_clp',pagadoClp:'pagado_clp',estado:'estado',operationId:'operation_id',creadoEn:'creado_en',pagadoEn:'pagado_en'});
export const compras=table('compras',{id:'id',numero:'numero',proveedorId:'proveedor_id',estado:'estado',ordenId:'orden_id',nota:'nota',creadoEn:'creado_en',enviadaEn:'enviada_en',recibidaEn:'recibida_en'});
export const compraItems=table('compra_items',{id:'id',compraId:'compra_id',repuestoId:'repuesto_id',ordenRepuestoId:'orden_repuesto_id',cantidad:'cantidad',recibida:'recibida',costoClp:'costo_clp'});
export const recepcionesCompra=table('recepciones_compra',{id:'id',compraId:'compra_id',operationId:'operation_id',resumen:'resumen',creadoEn:'creado_en'});
export const recibos=table('recibos',{id:'id',numero:'numero',ordenId:'orden_id',userId:'user_id',operationId:'operation_id',manoObraClp:'mano_obra_clp',repuestosClp:'repuestos_clp',bodegajeDias:'bodegaje_dias',bodegajeClp:'bodegaje_clp',abonosClp:'abonos_clp',totalClp:'total_clp',cobradoClp:'cobrado_clp',medioPago:'medio_pago',cobradoPor:'cobrado_por',creadoEn:'creado_en'});
export * from './schema.auth';
