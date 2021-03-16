import {ReservaPage} from '../page/reserva/reserva.po';
import {browser} from 'protractor';

describe('workspace-project Reserva', () => {
  let reserva: ReservaPage;
  const nombreSolicita = 'Camilo Prueba';
  const canchaId = 1;
  const fecha = '12-12-2021';
  const hora = '20:00';
  const valorAbono  = 10000;
  const scriptLocalStorageCancelarReserva = `localStorage.setItem('reservaSeleccionada',
     '{"id":"128","canchaId":"3141","nombreSolicita":"Camilo Prueba"}');`;
  const scriptLocalStorageFinalizarReserva = `localStorage.setItem('reservaSeleccionada',
     '{"id":"129","canchaId":"3126","nombreSolicita":"Camilo Prueba","fecha":"2021-05-11","hora":"22:00","valorAbono":10000}');`;

  beforeEach(() => {
    reserva = new ReservaPage();
  });

  it('Deberia crear una reserva', () => {
    reserva.navigateTo('reserva/crear-reserva');
    reserva.setCanchaOptionSelect(canchaId);
    reserva.ingresarNombreSolicita(nombreSolicita);
    reserva.ingresarFecha(fecha);
    reserva.ingresarHora(hora);
    reserva.ingresarValorAbono(valorAbono);
    reserva.clickCrearReserva();

    reserva.waitUntilToastMessageIsPresent();

    const mensajeEsperado = 'La reserva del señor(a): ' + nombreSolicita + ' ha sido creada exitosamente';
    // Act
    const toastContent =   reserva.getToastMessageText();

    // Assert
    expect(toastContent).toEqual(mensajeEsperado);
  });

  it('Deberia cancelar una reserva', () => {
    browser.executeScript(scriptLocalStorageCancelarReserva);
    reserva.navigateTo('reserva/cancelar-reserva');
    reserva.clickCancelarReserva();
    reserva.waitUntilToastMessageIsPresent();

    const mensajeEsperado = 'La reserva ha sido cancelada exitosamente';
    // Act
    const toastContent =   reserva.getToastMessageText();

    // Assert
    expect(toastContent).toEqual(mensajeEsperado);
  });

  it('Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido', async () => {
    reserva.navigateTo('reserva/crear-reserva');
    reserva.ingresarNombreSolicita(nombreSolicita);
    expect(reserva.isEnableButtonCrearReserva()).toBeFalsy();
  });

  it('Deberia finalizar una reserva', () => {
    browser.executeScript(scriptLocalStorageFinalizarReserva);
    reserva.navigateTo('reserva/finalizar-reserva');
    reserva.ingresarValorRestante(50000);
    reserva.clickFinalizarReserva();
    reserva.waitUntilToastMessageIsPresent();

    const mensajeEsperado = 'La reserva ha sido finalizada exitosamente';
    // Act
    const toastContent =   reserva.getToastMessageText();

    // Assert
    expect(toastContent).toEqual(mensajeEsperado);
  });

  it('Deberia listar reservas', () => {
    reserva.navigateTo('reserva');
    expect(reserva.contarReservas()).toBeGreaterThanOrEqual(0);
  });
});
