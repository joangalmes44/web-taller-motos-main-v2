// Todas las palabras de las páginas de cuenta y de sus e-mails, en un solo lugar (español rioplatense, con voseo).
export const text = {
  signIn: {
    title: 'Entrá a tu cuenta',
    lead: 'Ingresá para ver tus reservas y el estado de tu moto.',
    submit: 'Ingresar',
    forgot: '¿Olvidaste tu contraseña?',
    other: '¿Primera vez por acá?',
    otherLink: 'Creá tu cuenta',
  },
  signUp: {
    title: 'Creá tu cuenta',
    lead: 'Te lleva menos de un minuto y después reservás tu hora.',
    submit: 'Crear cuenta',
    other: '¿Ya tenés cuenta?',
    otherLink: 'Ingresá',
  },
  fields: {
    name: 'Nombre',
    email: 'Correo electrónico',
    password: 'Contraseña',
    newPassword: 'Nueva contraseña',
    currentPassword: 'Contraseña actual',
    code: 'Código',
  },
  google: 'Seguir con Google',
  orEmail: 'o con tu correo',
  googleFailed: 'No pudimos terminar el ingreso con Google. Probá de nuevo.',
  googleNotLinked:
    'Ese correo ya tiene una cuenta con contraseña. Ingresá con ella, confirmá tu correo en /account y después Google también te va a funcionar.',
  wait: 'Esperá un momento…',
  verifyingHuman: 'Verificando que sos una persona…',
  failed: 'Algo salió mal. Probá de nuevo.',
  passwordHint: 'Mínimo 8 caracteres.',
  /** loginfix: dentro del marco de otro sitio, un navegador que no guarda el ingreso ahí */
  framedBlocked:
    'Ya ingresaste, pero este navegador no guarda la sesión dentro de otro sitio web. Abrí la app en su propia pestaña para seguir.',
  openNewTab: 'Abrir en una pestaña nueva',
  /** ownermail: solo el ingreso y el registro de la vista previa; sus cuentas viven en la base de la vista previa */
  previewAccounts:
    'Vista previa: las cuentas que crees acá son de prueba y quedan en la vista previa. La app publicada tiene sus propias cuentas: tenés que registrarte de nuevo ahí.',
  /** Mensajes de error para códigos enviados por Supabase Auth. */
  codeErrors: {
    INVALID_OTP: 'Ese código no es correcto. Revisalo y probá de nuevo.',
    OTP_EXPIRED: 'Ese código venció. Pedí uno nuevo.',
    TOO_MANY_ATTEMPTS: 'Hiciste demasiados intentos fallidos. Pedí un código nuevo.',
  } as Partial<Record<string, string>>,
  verify: {
    title: 'Revisá tu correo',
    lead: (email: string) => `Te mandamos un código de 8 dígitos a ${email}. Ingresalo para confirmar tu dirección.`,
    leadNoEmail: 'Ingresá tu correo y el código de 8 dígitos que te mandamos.',
    submit: 'Confirmar correo',
    done: 'Tu correo quedó confirmado.',
  },
  resend: {
    send: 'Mandame un código',
    again: 'Mandame un código nuevo',
    wait: (seconds: number) => `Código nuevo en ${String(seconds)} s`,
    sent: 'Código enviado. Te sirve durante 10 minutos.',
  },
  forgot: {
    title: 'Recuperá tu contraseña',
    lead: 'Ingresá tu correo y te mandamos un código de 8 dígitos.',
    sendCode: 'Mandar código',
    codeLead: (email: string) =>
      `Si ${email} tiene una cuenta, el código ya va en camino. Ingresalo junto con tu nueva contraseña.`,
    submit: 'Guardar nueva contraseña',
    done: 'Cambiaste tu contraseña. Ingresá con la nueva.',
    back: 'Volver a ingresar',
  },
  account: {
    title: 'Tu cuenta',
    signedInWith: (methods: string) => `Ingresaste con ${methods}`,
    profile: 'Perfil',
    save: 'Guardar',
    saved: 'Guardado.',
    verified: 'Confirmado',
    unverified: 'Sin confirmar',
    confirmEmail: 'Confirmá tu correo',
    password: 'Contraseña',
    changePassword: 'Cambiar contraseña',
    passwordChanged: 'Cambiaste la contraseña. Cerramos la sesión en tus otros dispositivos.',
    devices: 'Dispositivos',
    unknownDevice: 'Dispositivo desconocido',
    signOut: 'Salir',
    adminAccess: 'Acceso de administración',
    adminLead: (email: string) => `Confirmá ${email} para abrir las páginas de administración.`,
    danger: 'Eliminar cuenta',
    dangerLead: 'Esto elimina tu cuenta y cierra tu sesión. No se puede deshacer.',
    deleteConfirm: 'Eliminar mi cuenta',
    deleteFailed: 'No pudimos eliminar tu cuenta. Probá de nuevo o escribinos.',
  },
  email: {
    verifySubject: 'Tu código de confirmación',
    resetSubject: 'Tu código para cambiar la contraseña',
    body: (code: string) =>
      `<p>Tu código es:</p><p style="font-size:28px;font-weight:600;letter-spacing:6px;font-family:monospace">${code}</p><p>Te sirve durante 10 minutos. Si no lo pediste vos, ignorá este correo.</p>`,
  },
  demo: {
    title: 'Accesos demo',
    lead: 'Solo en la vista previa: entrá con una cuenta de prueba de cada rol.',
    enter: 'Entrar como',
    entering: 'Ingresando…',
  },
};
