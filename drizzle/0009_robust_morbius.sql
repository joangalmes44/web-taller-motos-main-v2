CREATE TABLE `abonos` (
	`id` text PRIMARY KEY NOT NULL,
	`orden_id` text NOT NULL,
	`orden_repuesto_id` text,
	`concepto` text NOT NULL,
	`requerido_clp` integer NOT NULL,
	`pagado_clp` integer DEFAULT 0 NOT NULL,
	`estado` text DEFAULT 'Pendiente' NOT NULL,
	`operation_id` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`pagado_en` text,
	FOREIGN KEY (`orden_id`) REFERENCES `ordenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`orden_repuesto_id`) REFERENCES `orden_repuestos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "abonos_estado_check" CHECK("abonos"."estado" in ('Pendiente','Pagado','Aplicado'))
);
--> statement-breakpoint
CREATE INDEX `abonos_orden` ON `abonos` (`orden_id`,`estado`);--> statement-breakpoint
CREATE INDEX `abonos_orden_repuesto` ON `abonos` (`orden_repuesto_id`);--> statement-breakpoint
CREATE TABLE `compra_items` (
	`id` text PRIMARY KEY NOT NULL,
	`compra_id` text NOT NULL,
	`repuesto_id` text NOT NULL,
	`orden_repuesto_id` text,
	`cantidad` integer NOT NULL,
	`recibida` integer DEFAULT 0 NOT NULL,
	`costo_clp` integer NOT NULL,
	FOREIGN KEY (`compra_id`) REFERENCES `compras`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`repuesto_id`) REFERENCES `repuestos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`orden_repuesto_id`) REFERENCES `orden_repuestos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "compra_items_cant" CHECK("compra_items"."cantidad" > 0 and "compra_items"."recibida" >= 0)
);
--> statement-breakpoint
CREATE INDEX `compra_items_compra` ON `compra_items` (`compra_id`);--> statement-breakpoint
CREATE INDEX `compra_items_repuesto` ON `compra_items` (`repuesto_id`);--> statement-breakpoint
CREATE INDEX `compra_items_orden_repuesto` ON `compra_items` (`orden_repuesto_id`);--> statement-breakpoint
CREATE TABLE `compras` (
	`id` text PRIMARY KEY NOT NULL,
	`numero` integer NOT NULL,
	`proveedor_id` text NOT NULL,
	`estado` text DEFAULT 'Borrador' NOT NULL,
	`orden_id` text,
	`nota` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`enviada_en` text,
	`recibida_en` text,
	FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`orden_id`) REFERENCES `ordenes`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "compras_estado_check" CHECK("compras"."estado" in ('Borrador','Enviada','Recibida parcial','Recibida','Anulada'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `compras_numero` ON `compras` (`numero`);--> statement-breakpoint
CREATE INDEX `compras_estado` ON `compras` (`estado`,`creado_en`);--> statement-breakpoint
CREATE INDEX `compras_proveedor` ON `compras` (`proveedor_id`);--> statement-breakpoint
CREATE INDEX `compras_orden` ON `compras` (`orden_id`);--> statement-breakpoint
CREATE TABLE `orden_repuestos` (
	`id` text PRIMARY KEY NOT NULL,
	`orden_id` text NOT NULL,
	`repuesto_id` text NOT NULL,
	`adicional_id` text,
	`cantidad` integer NOT NULL,
	`precio_clp` integer NOT NULL,
	`estado` text NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`orden_id`) REFERENCES `ordenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`repuesto_id`) REFERENCES `repuestos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`adicional_id`) REFERENCES `adicionales`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "orden_repuestos_estado_check" CHECK("orden_repuestos"."estado" in ('Reservado','Esperando abono','Pedido','Usado','Liberado')),
	CONSTRAINT "orden_repuestos_cant" CHECK("orden_repuestos"."cantidad" > 0)
);
--> statement-breakpoint
CREATE INDEX `orden_repuestos_orden` ON `orden_repuestos` (`orden_id`,`estado`);--> statement-breakpoint
CREATE INDEX `orden_repuestos_repuesto` ON `orden_repuestos` (`repuesto_id`);--> statement-breakpoint
CREATE INDEX `orden_repuestos_adicional` ON `orden_repuestos` (`adicional_id`);--> statement-breakpoint
CREATE TABLE `recepciones_compra` (
	`id` text PRIMARY KEY NOT NULL,
	`compra_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`resumen` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`compra_id`) REFERENCES `compras`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recepciones_operation` ON `recepciones_compra` (`operation_id`);--> statement-breakpoint
CREATE INDEX `recepciones_por_compra` ON `recepciones_compra` (`compra_id`);--> statement-breakpoint
CREATE TABLE `recibos` (
	`id` text PRIMARY KEY NOT NULL,
	`numero` integer NOT NULL,
	`orden_id` text NOT NULL,
	`user_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`mano_obra_clp` integer NOT NULL,
	`repuestos_clp` integer NOT NULL,
	`bodegaje_dias` integer DEFAULT 0 NOT NULL,
	`bodegaje_clp` integer DEFAULT 0 NOT NULL,
	`abonos_clp` integer DEFAULT 0 NOT NULL,
	`total_clp` integer NOT NULL,
	`cobrado_clp` integer NOT NULL,
	`medio_pago` text NOT NULL,
	`cobrado_por` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`orden_id`) REFERENCES `ordenes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recibos_numero` ON `recibos` (`numero`);--> statement-breakpoint
CREATE UNIQUE INDEX `recibos_orden` ON `recibos` (`orden_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recibos_operation` ON `recibos` (`operation_id`);--> statement-breakpoint
CREATE INDEX `recibos_user` ON `recibos` (`user_id`,`creado_en`);--> statement-breakpoint
CREATE INDEX `recibos_creado` ON `recibos` (`creado_en`);--> statement-breakpoint
ALTER TABLE `movimientos_stock` ADD `orden_id` text REFERENCES ordenes(id);--> statement-breakpoint
ALTER TABLE `movimientos_stock` ADD `compra_id` text REFERENCES compras(id);--> statement-breakpoint
ALTER TABLE `movimientos_stock` ADD `operation_id` text;--> statement-breakpoint
CREATE INDEX `movimientos_orden` ON `movimientos_stock` (`orden_id`);--> statement-breakpoint
CREATE INDEX `movimientos_compra` ON `movimientos_stock` (`compra_id`);--> statement-breakpoint
ALTER TABLE `ordenes` ADD `lista_en` text;--> statement-breakpoint
ALTER TABLE `ordenes` ADD `entregada_en` text;--> statement-breakpoint
ALTER TABLE `ordenes` ADD `estado_antes_repuesto` text;--> statement-breakpoint
CREATE TRIGGER movimientos_stock_ins BEFORE INSERT ON movimientos_stock BEGIN
  SELECT RAISE(ABORT,'cantidad_invalida') WHERE NEW.cantidad = 0 OR (NEW.tipo IN ('ingreso','reserva','liberacion') AND NEW.cantidad < 0) OR (NEW.tipo = 'salida' AND NEW.cantidad > 0);
  SELECT RAISE(ABORT,'stock_negativo') WHERE NEW.tipo IN ('salida','ajuste') AND (SELECT coalesce(sum(cantidad),0) FROM movimientos_stock WHERE repuesto_id = NEW.repuesto_id AND tipo IN ('ingreso','salida','ajuste')) + NEW.cantidad < 0;
  SELECT RAISE(ABORT,'stock_agotado') WHERE NEW.tipo = 'reserva' AND (SELECT coalesce(sum(CASE WHEN tipo IN ('ingreso','salida','ajuste') THEN cantidad WHEN tipo = 'reserva' THEN -cantidad WHEN tipo = 'liberacion' THEN cantidad ELSE 0 END),0) FROM movimientos_stock WHERE repuesto_id = NEW.repuesto_id) < NEW.cantidad;
END;
--> statement-breakpoint
CREATE TRIGGER compra_items_recibida BEFORE UPDATE OF recibida ON compra_items BEGIN
  SELECT RAISE(ABORT,'recepcion_excede') WHERE NEW.recibida > NEW.cantidad;
END;
