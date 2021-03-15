import {CanchaPage} from '../page/cancha/cancha.po';

describe('workspace-project Cancha', () => {
  let cancha: CanchaPage;
  const nombreCancha = 'CANCHA PRUEBA';
  const descripcion = 'CANCHA PRUEBA DESCRIPCION';
  const valorDia = 50000;
  const valorNoche = 60000;

  beforeEach(() => {
    cancha = new CanchaPage();
  });

  it('Deberia crear una cancha', () => {
    cancha.navigateTo('cancha/crear-cancha');
    cancha.ingresarNombre(nombreCancha);
    cancha.ingresarDescripcion(descripcion);
    cancha.ingresarValorDia(valorDia);
    cancha.ingresarValorNoche(valorNoche);
    cancha.clickCrearCancha();

    cancha.waitUntilToastMessageIsPresent();
    const mensajeEsperado = 'La cancha: ' + nombreCancha + ' ha sido creada exitosamente';
    // Act
    const toastContent = cancha.getToastMessageText();

    // Assert
    expect(toastContent).toEqual(mensajeEsperado);
  });

  it('Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido', async () => {
    cancha.navigateTo('cancha/crear-cancha');
    cancha.ingresarNombre(nombreCancha);
    expect(cancha.isEnableButtonCrearCancha()).toBeFalsy();
  });

  it('Deberia listar canchas', () => {
    cancha.navigateTo('cancha');
    expect(cancha.contarCanchas()).toBeGreaterThanOrEqual(0);
  });
});
