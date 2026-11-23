INSERT INTO puestos (id, numero, nombre, descripcion, equipado) VALUES
('puesto-1', 1, 'Puesto 1', 'Elevador general', 0),
('puesto-2', 2, 'Puesto 2', 'Elevador general', 0),
('puesto-3', 3, 'Puesto 3', 'Suspensión, geometría y diagnóstico electrónico', 1);
--> statement-breakpoint
INSERT INTO servicios (id, nombre, descripcion, solo_puesto_equipado, nota, orden) VALUES
('mantencion', 'Mantención programada', 'Cambio de aceite y filtros, revisión de pauta y ajustes según el kilometraje.', 0, 'Más repuestos de la pauta', 1),
('diagnostico', 'Diagnóstico electrónico', 'Lectura de fallas, sensores e inyección con scanner.', 1, 'Solo en el Puesto 3', 2),
('suspension', 'Suspensión y geometría', 'Horquilla, amortiguador, retenes, alineación y geometría.', 1, 'Solo en el Puesto 3', 3),
('frenos', 'Frenos', 'Pastillas, discos, líquido y purga del sistema.', 0, NULL, 4),
('motor', 'Motor y afinamiento', 'Afinamiento, válvulas, sincronizado y puesta a punto.', 0, NULL, 5),
('neumaticos', 'Neumáticos y balanceo', 'Cambio, montaje y balanceo de ruedas.', 0, 'Precio por eje', 6);
--> statement-breakpoint
INSERT INTO servicio_tarifas (id, servicio_id, rango, duracion_min, precio_clp) VALUES
('mantencion-A', 'mantencion', 'A', 60, 35000),
('mantencion-B', 'mantencion', 'B', 90, 48000),
('mantencion-C', 'mantencion', 'C', 120, 62000),
('diagnostico-A', 'diagnostico', 'A', 60, 30000),
('diagnostico-B', 'diagnostico', 'B', 60, 30000),
('diagnostico-C', 'diagnostico', 'C', 60, 30000),
('suspension-A', 'suspension', 'A', 120, 55000),
('suspension-B', 'suspension', 'B', 150, 70000),
('suspension-C', 'suspension', 'C', 180, 90000),
('frenos-A', 'frenos', 'A', 60, 25000),
('frenos-B', 'frenos', 'B', 60, 32000),
('frenos-C', 'frenos', 'C', 90, 40000),
('motor-A', 'motor', 'A', 120, 60000),
('motor-B', 'motor', 'B', 180, 85000),
('motor-C', 'motor', 'C', 240, 120000),
('neumaticos-A', 'neumaticos', 'A', 30, 15000),
('neumaticos-B', 'neumaticos', 'B', 60, 20000),
('neumaticos-C', 'neumaticos', 'C', 60, 25000);
--> statement-breakpoint
INSERT INTO mecanicos (id, user_id, nombre, comision_pct, especialidad) VALUES
('mec-1', NULL, 'MatíasOrellana', 35, 'Mantención y frenos'),
('mec-2', NULL, 'Cristóbal Araya', 35, 'Motor y afinamiento'),
('mec-3', NULL, 'Felipe Quintana', 40, 'Suspensión y electrónica');
--> statement-breakpoint
INSERT INTO proveedores (id, nombre, rubro, contacto, telefono, plazo_dias) VALUES
('prov-1', 'Distribuidora Andes Moto', 'Repuestos multimarca', 'Ventas Andes Moto', '+56 2 2555 0101', 3),
('prov-2', 'Importadora Neumax', 'Neumáticos y cámaras', 'Pedidos Neumax', '+56 2 2555 0202', 5),
('prov-3', 'Casa de Lubricantes Pacífico', 'Aceites y lubricantes', 'Despacho Pacífico', '+56 2 2555 0303', 2);
--> statement-breakpoint
INSERT INTO repuestos (id, sku, nombre, compatibilidad, costo_clp, precio_clp, stock_minimo, especial, proveedor_id) VALUES
('rep-01', 'FIL-ACE-300', 'Filtro de aceite 300 cc', 'Honda CB300, Yamaha FZ25, KTM Duke 390', 3200, 6500, 6, 0, 'prov-1'),
('rep-02', 'FIL-ACE-650', 'Filtro de aceite 650 cc', 'Kawasaki Versys 650, Suzuki SV650, Yamaha MT-07', 4100, 8500, 5, 0, 'prov-1'),
('rep-03', 'FIL-ACE-800', 'Filtro de aceite 800 cc', 'Triumph Tiger 800, Ducati Scrambler 800, MV Agusta', 5200, 10500, 4, 0, 'prov-1'),
('rep-04', 'FIL-AIR-300', 'Filtro de aire 300 cc', 'Honda CB300, Yamaha FZ25', 5800, 11900, 4, 0, 'prov-1'),
('rep-05', 'FIL-AIR-650', 'Filtro de aire 650 cc', 'Kawasaki Versys 650, Suzuki SV650', 7400, 15200, 3, 0, 'prov-1'),
('rep-06', 'FIL-AIR-800', 'Filtro de aire 800 cc', 'Triumph Tiger 800, Ducati Scrambler', 9800, 19900, 3, 0, 'prov-1'),
('rep-07', 'ACE-10W40', 'Aceite 10W40 semisintético (litro)', 'Todas las cilindradas', 6800, 12900, 20, 0, 'prov-3'),
('rep-08', 'ACE-10W50', 'Aceite 10W50 sintético (litro)', 'Motos 600 cc en adelante', 9400, 17500, 16, 0, 'prov-3'),
('rep-09', 'BUJ-CR8', 'Bujía CR8E', '125–400 cc', 2600, 5900, 8, 0, 'prov-1'),
('rep-10', 'BUJ-CR9', 'Bujía CR9EIA iridio', '600–1300 cc', 7900, 15500, 6, 0, 'prov-1'),
('rep-11', 'PAS-DEL-300', 'Pastillas de freno delanteras 300 cc', 'Honda CB300, Yamaha FZ25, KTM Duke 390', 8500, 17900, 4, 0, 'prov-1'),
('rep-12', 'PAS-TRA-300', 'Pastillas de freno traseras 300 cc', 'Honda CB300, Yamaha FZ25', 6200, 13500, 4, 0, 'prov-1'),
('rep-13', 'PAS-DEL-650', 'Pastillas de freno delanteras 650 cc', 'Kawasaki Versys 650, Suzuki SV650', 12900, 26500, 4, 0, 'prov-1'),
('rep-14', 'PAS-TRA-650', 'Pastillas de freno traseras 650 cc', 'Kawasaki Versys 650, Suzuki SV650', 9800, 19900, 3, 0, 'prov-1'),
('rep-15', 'PAS-DEL-800', 'Pastillas de freno delanteras 800+ cc', 'Triumph Tiger 800, BMW F800, Ducati', 16500, 33900, 3, 0, 'prov-1'),
('rep-16', 'DIS-DEL-300', 'Disco de freno delantero 300 cc', 'Honda CB300, Yamaha FZ25', 38000, 69900, 2, 0, 'prov-1'),
('rep-17', 'DIS-DEL-650', 'Disco de freno delantero 650 cc', 'Kawasaki Versys 650, Suzuki SV650', 64000, 112000, 2, 0, 'prov-1'),
('rep-18', 'KIT-ARR-300', 'Kit de arrastre 300 cc (cadena 520)', 'Honda CB300, Yamaha FZ25, KTM Duke 390', 34000, 59900, 2, 0, 'prov-1'),
('rep-19', 'KIT-ARR-650', 'Kit de arrastre 650 cc (cadena 525)', 'Kawasaki Versys 650, Suzuki SV650', 52000, 89900, 2, 0, 'prov-1'),
('rep-20', 'KIT-ARR-800', 'Kit de arrastre 800 cc (cadena 525 reforzada)', 'Triumph Tiger 800, BMW F800', 68000, 119000, 2, 0, 'prov-1'),
('rep-21', 'RET-HOR-800', 'Retenes de horquilla 800 cc (par)', 'Triumph Tiger 800, BMW F800 GS', 18500, 39900, 2, 1, 'prov-1'),
('rep-22', 'RET-HOR-650', 'Retenes de horquilla 650 cc (par)', 'Kawasaki Versys 650, Suzuki SV650', 12500, 28900, 2, 1, 'prov-1'),
('rep-23', 'ACE-HOR-10W', 'Aceite de horquilla 10W (litro)', 'Todas las cilindradas', 7200, 13900, 6, 0, 'prov-3'),
('rep-24', 'LIQ-FRE-DOT4', 'Líquido de frenos DOT 4 (500 ml)', 'Todas las cilindradas', 3900, 8500, 8, 0, 'prov-3'),
('rep-25', 'CAM-17-140', 'Cámara 17" 140/70', 'Motos de calle 300–650 cc', 6500, 12900, 4, 0, 'prov-2'),
('rep-26', 'CAM-18-120', 'Cámara 18" 120/90', 'Motos doble propósito', 7200, 14500, 3, 0, 'prov-2'),
('rep-27', 'NEU-110-70-17', 'Neumático 110/70-17 delantero', 'Honda CB300, Yamaha FZ25, KTM Duke 390', 38000, 69900, 4, 0, 'prov-2'),
('rep-28', 'NEU-140-70-17', 'Neumático 140/70-17 trasero', 'Kawasaki Versys 650, Suzuki SV650', 52000, 94900, 4, 0, 'prov-2'),
('rep-29', 'NEU-120-70-19', 'Neumático 120/70-19 delantero doble propósito', 'Triumph Tiger 800, BMW F800 GS', 68000, 124900, 2, 0, 'prov-2'),
('rep-30', 'NEU-170-60-17', 'Neumático 170/60-17 trasero deportivo', 'Yamaha MT-07, Ducati Scrambler', 74000, 134900, 2, 0, 'prov-2');
--> statement-breakpoint
INSERT INTO movimientos_stock (id, repuesto_id, tipo, cantidad, nota) VALUES
('mov-ini-01', 'rep-01', 'ingreso', 14, 'Stock inicial'),
('mov-ini-02', 'rep-02', 'ingreso', 10, 'Stock inicial'),
('mov-ini-03', 'rep-03', 'ingreso', 7, 'Stock inicial'),
('mov-ini-04', 'rep-04', 'ingreso', 8, 'Stock inicial'),
('mov-ini-05', 'rep-05', 'ingreso', 6, 'Stock inicial'),
('mov-ini-06', 'rep-06', 'ingreso', 4, 'Stock inicial'),
('mov-ini-07', 'rep-07', 'ingreso', 48, 'Stock inicial'),
('mov-ini-08', 'rep-08', 'ingreso', 30, 'Stock inicial'),
('mov-ini-09', 'rep-09', 'ingreso', 22, 'Stock inicial'),
('mov-ini-10', 'rep-10', 'ingreso', 12, 'Stock inicial'),
('mov-ini-12', 'rep-12', 'ingreso', 5, 'Stock inicial'),
('mov-ini-13', 'rep-13', 'ingreso', 8, 'Stock inicial'),
('mov-ini-14', 'rep-14', 'ingreso', 6, 'Stock inicial'),
('mov-ini-15', 'rep-15', 'ingreso', 5, 'Stock inicial'),
('mov-ini-16', 'rep-16', 'ingreso', 3, 'Stock inicial'),
('mov-ini-17', 'rep-17', 'ingreso', 2, 'Stock inicial'),
('mov-ini-18', 'rep-18', 'ingreso', 4, 'Stock inicial'),
('mov-ini-19', 'rep-19', 'ingreso', 3, 'Stock inicial'),
('mov-ini-20', 'rep-20', 'ingreso', 1, 'Stock inicial'),
('mov-ini-23', 'rep-23', 'ingreso', 12, 'Stock inicial'),
('mov-ini-24', 'rep-24', 'ingreso', 18, 'Stock inicial'),
('mov-ini-25', 'rep-25', 'ingreso', 9, 'Stock inicial'),
('mov-ini-26', 'rep-26', 'ingreso', 6, 'Stock inicial'),
('mov-ini-27', 'rep-27', 'ingreso', 6, 'Stock inicial'),
('mov-ini-28', 'rep-28', 'ingreso', 5, 'Stock inicial'),
('mov-ini-29', 'rep-29', 'ingreso', 3, 'Stock inicial'),
('mov-ini-30', 'rep-30', 'ingreso', 1, 'Stock inicial');
