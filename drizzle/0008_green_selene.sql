CREATE TABLE `adicional_repuestos` (
	`id` text PRIMARY KEY NOT NULL,
	`adicional_id` text NOT NULL,
	`repuesto_id` text NOT NULL,
	`cantidad` integer DEFAULT 1 NOT NULL,
	`precio_clp` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`adicional_id`) REFERENCES `adicionales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`repuesto_id`) REFERENCES `repuestos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "adicional_repuestos_cant" CHECK("adicional_repuestos"."cantidad" > 0)
);
--> statement-breakpoint
CREATE INDEX `adicional_repuestos_adicional` ON `adicional_repuestos` (`adicional_id`);--> statement-breakpoint
CREATE INDEX `adicional_repuestos_repuesto` ON `adicional_repuestos` (`repuesto_id`);--> statement-breakpoint
CREATE TABLE `adicionales` (
	`id` text PRIMARY KEY NOT NULL,
	`orden_id` text NOT NULL,
	`mecanico_id` text NOT NULL,
	`descripcion` text NOT NULL,
	`mano_obra_clp` integer DEFAULT 0 NOT NULL,
	`tiempo_extra_min` integer DEFAULT 0 NOT NULL,
	`estado` text DEFAULT 'Propuesto' NOT NULL,
	`estado_antes` text DEFAULT 'En diagnóstico' NOT NULL,
	`propuesto_en` text NOT NULL,
	`vence_en` text NOT NULL,
	`respondido_en` text,
	`respuesta_op` text,
	`operation_id` text NOT NULL,
	FOREIGN KEY (`orden_id`) REFERENCES `ordenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mecanico_id`) REFERENCES `mecanicos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "adicionales_estado_check" CHECK("adicionales"."estado" in ('Propuesto','Aprobado','Rechazado','Vencido')),
	CONSTRAINT "adicionales_valores_check" CHECK("adicionales"."mano_obra_clp" >= 0 and "adicionales"."tiempo_extra_min" >= 0 and "adicionales"."tiempo_extra_min" % 30 = 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `adicionales_operation` ON `adicionales` (`operation_id`);--> statement-breakpoint
CREATE INDEX `adicionales_orden` ON `adicionales` (`orden_id`,`propuesto_en`);--> statement-breakpoint
CREATE INDEX `adicionales_estado_vence` ON `adicionales` (`estado`,`vence_en`);--> statement-breakpoint
CREATE INDEX `adicionales_mecanico` ON `adicionales` (`mecanico_id`);--> statement-breakpoint
CREATE TABLE `orden_historial` (
	`id` text PRIMARY KEY NOT NULL,
	`orden_id` text NOT NULL,
	`estado` text NOT NULL,
	`nota` text DEFAULT '' NOT NULL,
	`autor` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`orden_id`) REFERENCES `ordenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `orden_historial_orden` ON `orden_historial` (`orden_id`,`creado_en`);--> statement-breakpoint
CREATE TABLE `ordenes` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_id` text NOT NULL,
	`numero` integer NOT NULL,
	`reserva_id` text,
	`user_id` text NOT NULL,
	`moto_id` text NOT NULL,
	`servicio_id` text NOT NULL,
	`puesto_id` text NOT NULL,
	`mecanico_id` text,
	`origen` text DEFAULT 'reserva' NOT NULL,
	`estado` text DEFAULT 'Recibida' NOT NULL,
	`km_ingreso` integer DEFAULT 0 NOT NULL,
	`combustible` text DEFAULT '1/2' NOT NULL,
	`danos` text DEFAULT '' NOT NULL,
	`notas` text DEFAULT '' NOT NULL,
	`mano_obra_clp` integer DEFAULT 0 NOT NULL,
	`extra_min` integer DEFAULT 0 NOT NULL,
	`inicio_plan` text NOT NULL,
	`fin_plan` text NOT NULL,
	`entrega_estimada` text NOT NULL,
	`entrega_movida` integer DEFAULT false NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`reserva_id`) REFERENCES `reservas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`moto_id`) REFERENCES `motos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`servicio_id`) REFERENCES `servicios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`puesto_id`) REFERENCES `puestos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mecanico_id`) REFERENCES `mecanicos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ordenes_estado_check" CHECK("ordenes"."estado" in ('Recibida','En diagnóstico','Esperando aprobación','Esperando repuesto','En reparación','Prueba de ruta','Lista para retirar','Entregada','Garantía','Anulada')),
	CONSTRAINT "ordenes_origen_check" CHECK("ordenes"."origen" in ('reserva','sin_hora'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ordenes_operation` ON `ordenes` (`operation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ordenes_numero` ON `ordenes` (`numero`);--> statement-breakpoint
CREATE UNIQUE INDEX `ordenes_reserva` ON `ordenes` (`reserva_id`);--> statement-breakpoint
CREATE INDEX `ordenes_user` ON `ordenes` (`user_id`,`creado_en`);--> statement-breakpoint
CREATE INDEX `ordenes_estado` ON `ordenes` (`estado`,`creado_en`);--> statement-breakpoint
CREATE INDEX `ordenes_mecanico` ON `ordenes` (`mecanico_id`,`inicio_plan`);--> statement-breakpoint
CREATE INDEX `ordenes_puesto` ON `ordenes` (`puesto_id`,`creado_en`);--> statement-breakpoint
CREATE INDEX `ordenes_moto` ON `ordenes` (`moto_id`);--> statement-breakpoint
CREATE INDEX `ordenes_servicio` ON `ordenes` (`servicio_id`);--> statement-breakpoint
CREATE TRIGGER ordenes_mecanico_ins BEFORE INSERT ON ordenes WHEN NEW.mecanico_id IS NOT NULL BEGIN
  SELECT RAISE(ABORT,'mecanico_ocupado') WHERE EXISTS (SELECT 1 FROM ordenes o WHERE o.mecanico_id=NEW.mecanico_id AND o.id<>NEW.id AND o.estado NOT IN ('Entregada','Anulada') AND o.inicio_plan<NEW.fin_plan AND o.fin_plan>NEW.inicio_plan);
END;
--> statement-breakpoint
CREATE TRIGGER ordenes_mecanico_upd BEFORE UPDATE OF mecanico_id, inicio_plan, fin_plan ON ordenes WHEN NEW.mecanico_id IS NOT NULL AND NEW.estado NOT IN ('Entregada','Anulada') BEGIN
  SELECT RAISE(ABORT,'mecanico_ocupado') WHERE EXISTS (SELECT 1 FROM ordenes o WHERE o.mecanico_id=NEW.mecanico_id AND o.id<>NEW.id AND o.estado NOT IN ('Entregada','Anulada') AND o.inicio_plan<NEW.fin_plan AND o.fin_plan>NEW.inicio_plan);
END;
