CREATE TABLE `mecanicos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`nombre` text NOT NULL,
	`comision_pct` integer NOT NULL,
	`especialidad` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "mecanicos_pct_check" CHECK("mecanicos"."comision_pct" in (35,40))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mecanicos_user` ON `mecanicos` (`user_id`);--> statement-breakpoint
CREATE TABLE `movimientos_stock` (
	`id` text PRIMARY KEY NOT NULL,
	`repuesto_id` text NOT NULL,
	`tipo` text NOT NULL,
	`cantidad` integer NOT NULL,
	`nota` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`repuesto_id`) REFERENCES `repuestos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "movimientos_tipo_check" CHECK("movimientos_stock"."tipo" in ('ingreso','salida','ajuste','reserva','liberacion'))
);
--> statement-breakpoint
CREATE INDEX `movimientos_repuesto` ON `movimientos_stock` (`repuesto_id`);--> statement-breakpoint
CREATE TABLE `perfiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`rol` text DEFAULT 'cliente' NOT NULL,
	`nombre` text DEFAULT '' NOT NULL,
	`telefono` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "perfiles_rol_check" CHECK("perfiles"."rol" in ('cliente','mecanico','recepcion','administracion'))
);
--> statement-breakpoint
CREATE INDEX `perfiles_rol` ON `perfiles` (`rol`);--> statement-breakpoint
CREATE TABLE `proveedores` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`rubro` text NOT NULL,
	`contacto` text,
	`telefono` text,
	`plazo_dias` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `puestos` (
	`id` text PRIMARY KEY NOT NULL,
	`numero` integer NOT NULL,
	`nombre` text NOT NULL,
	`descripcion` text NOT NULL,
	`equipado` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repuestos` (
	`id` text PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`nombre` text NOT NULL,
	`compatibilidad` text NOT NULL,
	`costo_clp` integer NOT NULL,
	`precio_clp` integer NOT NULL,
	`stock_minimo` integer DEFAULT 0 NOT NULL,
	`especial` integer DEFAULT false NOT NULL,
	`proveedor_id` text,
	FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "repuestos_precio_check" CHECK("repuestos"."costo_clp" >= 0 and "repuestos"."precio_clp" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repuestos_sku` ON `repuestos` (`sku`);--> statement-breakpoint
CREATE INDEX `repuestos_proveedor` ON `repuestos` (`proveedor_id`);--> statement-breakpoint
CREATE TABLE `servicio_tarifas` (
	`id` text PRIMARY KEY NOT NULL,
	`servicio_id` text NOT NULL,
	`rango` text NOT NULL,
	`duracion_min` integer NOT NULL,
	`precio_clp` integer NOT NULL,
	FOREIGN KEY (`servicio_id`) REFERENCES `servicios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tarifas_rango_check" CHECK("servicio_tarifas"."rango" in ('A','B','C')),
	CONSTRAINT "tarifas_duracion_check" CHECK("servicio_tarifas"."duracion_min" > 0 and "servicio_tarifas"."duracion_min" % 30 = 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `servicio_tarifas_servicio_rango` ON `servicio_tarifas` (`servicio_id`,`rango`);--> statement-breakpoint
CREATE TABLE `servicios` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`descripcion` text NOT NULL,
	`solo_puesto_equipado` integer DEFAULT false NOT NULL,
	`nota` text,
	`orden` integer DEFAULT 0 NOT NULL
);
