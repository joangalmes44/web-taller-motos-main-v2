CREATE TABLE `moto_km` (
	`id` text PRIMARY KEY NOT NULL,
	`moto_id` text NOT NULL,
	`km` integer NOT NULL,
	`fuente` text DEFAULT 'cliente' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`moto_id`) REFERENCES `motos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `moto_km_moto` ON `moto_km` (`moto_id`,`creado_en`);--> statement-breakpoint
CREATE TABLE `motos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`patente` text NOT NULL,
	`marca` text NOT NULL,
	`modelo` text NOT NULL,
	`cc` integer NOT NULL,
	`km_actual` integer DEFAULT 0 NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "motos_cc_check" CHECK("motos"."cc" between 125 and 1300),
	CONSTRAINT "motos_km_check" CHECK("motos"."km_actual" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `motos_patente` ON `motos` (`patente`);--> statement-breakpoint
CREATE INDEX `motos_user` ON `motos` (`user_id`);--> statement-breakpoint
CREATE TABLE `reservas` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`moto_id` text NOT NULL,
	`servicio_id` text NOT NULL,
	`puesto_id` text NOT NULL,
	`inicio` text NOT NULL,
	`fin` text NOT NULL,
	`duracion_min` integer NOT NULL,
	`precio_clp` integer NOT NULL,
	`estado` text DEFAULT 'Confirmada' NOT NULL,
	`abono_requerido_clp` integer DEFAULT 0 NOT NULL,
	`abono_pagado_clp` integer DEFAULT 0 NOT NULL,
	`reprogramada_de` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`moto_id`) REFERENCES `motos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`servicio_id`) REFERENCES `servicios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`puesto_id`) REFERENCES `puestos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "reservas_estado_check" CHECK("reservas"."estado" in ('Pendiente','Confirmada','En taller','No asistió','Cancelada','Reprogramada')),
	CONSTRAINT "reservas_fin_check" CHECK("reservas"."fin" > "reservas"."inicio")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reservas_operation` ON `reservas` (`operation_id`);--> statement-breakpoint
CREATE INDEX `reservas_puesto_inicio` ON `reservas` (`puesto_id`,`inicio`);--> statement-breakpoint
CREATE INDEX `reservas_inicio` ON `reservas` (`inicio`);--> statement-breakpoint
CREATE INDEX `reservas_user_inicio` ON `reservas` (`user_id`,`inicio`);--> statement-breakpoint
CREATE INDEX `reservas_user_estado` ON `reservas` (`user_id`,`estado`,`inicio`);--> statement-breakpoint
CREATE INDEX `reservas_moto` ON `reservas` (`moto_id`);
--> statement-breakpoint
CREATE TRIGGER reservas_validar_ins BEFORE INSERT ON reservas WHEN NEW.estado IN ('Pendiente','Confirmada','En taller') BEGIN
  SELECT RAISE(ABORT,'horario_invalido') WHERE NOT (substr(NEW.inicio,1,10)=substr(NEW.fin,1,10) AND substr(NEW.inicio,15,2) IN ('00','30') AND substr(NEW.fin,15,2) IN ('00','30') AND strftime('%w',substr(NEW.inicio,1,10))<>'0' AND substr(NEW.inicio,12,5)>='11:00' AND substr(NEW.fin,12,5)<=CASE strftime('%w',substr(NEW.inicio,1,10)) WHEN '6' THEN '16:00' ELSE '20:00' END);
  SELECT RAISE(ABORT,'cc_fuera_de_rango') WHERE (SELECT cc FROM motos WHERE id=NEW.moto_id) NOT BETWEEN 125 AND 1300;
  SELECT RAISE(ABORT,'duracion_invalida') WHERE NEW.duracion_min IS NOT (SELECT t.duracion_min FROM servicio_tarifas t JOIN motos m ON m.id=NEW.moto_id WHERE t.servicio_id=NEW.servicio_id AND t.rango=CASE WHEN m.cc<=400 THEN 'A' WHEN m.cc<=800 THEN 'B' ELSE 'C' END) OR (julianday(NEW.fin)-julianday(NEW.inicio))*1440 > NEW.duracion_min+0.5 OR (julianday(NEW.fin)-julianday(NEW.inicio))*1440 < NEW.duracion_min-0.5;
  SELECT RAISE(ABORT,'puesto_incompatible') WHERE (SELECT solo_puesto_equipado FROM servicios WHERE id=NEW.servicio_id)=1 AND (SELECT equipado FROM puestos WHERE id=NEW.puesto_id)=0;
  SELECT RAISE(ABORT,'puesto_ocupado') WHERE EXISTS (SELECT 1 FROM reservas r WHERE r.puesto_id=NEW.puesto_id AND r.id<>NEW.id AND r.estado IN ('Pendiente','Confirmada','En taller') AND r.inicio<NEW.fin AND r.fin>NEW.inicio);
  SELECT RAISE(ABORT,'sin_mecanico') WHERE EXISTS (SELECT 1 FROM (SELECT NEW.inicio AS t UNION SELECT r.inicio FROM reservas r WHERE r.estado IN ('Pendiente','Confirmada','En taller') AND r.id<>NEW.id AND r.inicio>NEW.inicio AND r.inicio<NEW.fin) p WHERE (SELECT count(*) FROM reservas q WHERE q.estado IN ('Pendiente','Confirmada','En taller') AND q.id<>NEW.id AND q.inicio<=p.t AND q.fin>p.t) >= (SELECT count(*) FROM mecanicos));
END;
--> statement-breakpoint
CREATE TRIGGER reservas_validar_upd BEFORE UPDATE ON reservas WHEN NEW.estado IN ('Pendiente','Confirmada','En taller') AND (OLD.estado NOT IN ('Pendiente','Confirmada','En taller') OR OLD.inicio<>NEW.inicio OR OLD.fin<>NEW.fin OR OLD.puesto_id<>NEW.puesto_id) BEGIN
  SELECT RAISE(ABORT,'horario_invalido') WHERE NOT (substr(NEW.inicio,1,10)=substr(NEW.fin,1,10) AND substr(NEW.inicio,15,2) IN ('00','30') AND substr(NEW.fin,15,2) IN ('00','30') AND strftime('%w',substr(NEW.inicio,1,10))<>'0' AND substr(NEW.inicio,12,5)>='11:00' AND substr(NEW.fin,12,5)<=CASE strftime('%w',substr(NEW.inicio,1,10)) WHEN '6' THEN '16:00' ELSE '20:00' END);
  SELECT RAISE(ABORT,'cc_fuera_de_rango') WHERE (SELECT cc FROM motos WHERE id=NEW.moto_id) NOT BETWEEN 125 AND 1300;
  SELECT RAISE(ABORT,'duracion_invalida') WHERE NEW.duracion_min IS NOT (SELECT t.duracion_min FROM servicio_tarifas t JOIN motos m ON m.id=NEW.moto_id WHERE t.servicio_id=NEW.servicio_id AND t.rango=CASE WHEN m.cc<=400 THEN 'A' WHEN m.cc<=800 THEN 'B' ELSE 'C' END) OR (julianday(NEW.fin)-julianday(NEW.inicio))*1440 > NEW.duracion_min+0.5 OR (julianday(NEW.fin)-julianday(NEW.inicio))*1440 < NEW.duracion_min-0.5;
  SELECT RAISE(ABORT,'puesto_incompatible') WHERE (SELECT solo_puesto_equipado FROM servicios WHERE id=NEW.servicio_id)=1 AND (SELECT equipado FROM puestos WHERE id=NEW.puesto_id)=0;
  SELECT RAISE(ABORT,'puesto_ocupado') WHERE EXISTS (SELECT 1 FROM reservas r WHERE r.puesto_id=NEW.puesto_id AND r.id<>NEW.id AND r.estado IN ('Pendiente','Confirmada','En taller') AND r.inicio<NEW.fin AND r.fin>NEW.inicio);
  SELECT RAISE(ABORT,'sin_mecanico') WHERE EXISTS (SELECT 1 FROM (SELECT NEW.inicio AS t UNION SELECT r.inicio FROM reservas r WHERE r.estado IN ('Pendiente','Confirmada','En taller') AND r.id<>NEW.id AND r.inicio>NEW.inicio AND r.inicio<NEW.fin) p WHERE (SELECT count(*) FROM reservas q WHERE q.estado IN ('Pendiente','Confirmada','En taller') AND q.id<>NEW.id AND q.inicio<=p.t AND q.fin>p.t) >= (SELECT count(*) FROM mecanicos));
END;
--> statement-breakpoint
CREATE TRIGGER motos_km_no_baja BEFORE UPDATE OF km_actual ON motos WHEN NEW.km_actual < OLD.km_actual BEGIN SELECT RAISE(ABORT,'km_menor'); END;
