import {browser, by, element, ElementFinder, ExpectedConditions, ProtractorExpectedConditions} from 'protractor';

export class ReservaPage {

  private listaReservas = element.all(by.css('table td'));
  private inputIdCanchaId = element(by.id('canchaId'));
  private inputIdNombreSolicita = element(by.id('nombreSolicita'));
  private inputIdFecha = element(by.id('fecha'));
  private inputIdHora = element(by.id('hora'));
  private inputIdEstado = element(by.id('estado'));
  private inputIdValorAbono = element(by.id('valorAbono'));
  private inputIdValorRestante = element(by.id('valorRestante'));
  private butttonCrearReserva = element(by.id('buttonCrearReserva'));
  private butttonCancelarReserva = element(by.id('buttonCancelarReserva'));
  private butttonFinalizarReserva = element(by.id('buttonFinalizarReserva'));

  until: ProtractorExpectedConditions;

  constructor() {
    this.until = ExpectedConditions;
  }

  // navegando
  navigateTo(url): Promise<void> {
    return browser.get(`${browser.baseUrl}${url}`) as Promise<void>;
  }

  async contarReservas() {
    return this.listaReservas.count();
  }
  async ingresarCanchaId(canchaId) {
    await this.inputIdCanchaId.sendKeys(canchaId);
  }
  async ingresarNombreSolicita(nombreSolicita) {
    await this.inputIdNombreSolicita.sendKeys(nombreSolicita);
  }
  async ingresarFecha(fecha) {
    await this.inputIdFecha.sendKeys(fecha);
  }
  async ingresarHora(hora) {
    await this.inputIdHora.sendKeys(hora);
  }
  async ingresaEstado(estado) {
    await this.inputIdEstado.sendKeys(estado);
  }
  async ingresarValorAbono(valorAbono) {
    await this.inputIdValorAbono.sendKeys(valorAbono);
  }
  async ingresarValorRestante(valorRestante) {
    await this.inputIdValorRestante.sendKeys(valorRestante);
  }
  async clickCrearReserva() {
    return this.butttonCrearReserva.click();
  }
  async isEnableButtonCrearReserva() {
    return this.butttonCrearReserva.isEnabled();
  }
  async clickCancelarReserva() {
    return this.butttonCancelarReserva.click();
  }
  async clickFinalizarReserva() {
    return this.butttonFinalizarReserva.click();
  }

  async getToastMessageText(): Promise<string> {
    return await this.getToastMessage().getText();
  }

  getToastMessage(): ElementFinder {
    return element(by.className('toast-message'));
  }

  async waitUntilToastMessageIsPresent(): Promise<void> {
    return await this.waitUntilIsPresent(this.getToastMessage());
  }

  async setCanchaOptionSelect(optionI: number): Promise<void> {
    // Tick to wait until options apear
    await browser.sleep(100);
    // End tick
    const options: ElementFinder[] = await this.inputIdCanchaId.all(by.tagName('option'));
    options[optionI].click();
  }

  async waitUntilIsPresent(element: ElementFinder): Promise<void> {
    const id = await element.getId()
    return await browser.wait(
      this.until.presenceOf(element),
      5000,
      `Element ${id} taking too long to appear in the DOM`
    );
  }
}
