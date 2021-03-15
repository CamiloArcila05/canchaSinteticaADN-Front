import {browser, by, element, ElementFinder, ExpectedConditions, ProtractorExpectedConditions} from 'protractor';

export class CanchaPage {

  private listaCanchas = element.all(by.css('table td'));
  private inputIdNombre = element(by.id('nombre'));
  private inputIdValorDia = element(by.id('valorDia'));
  private inputIdValorNoche = element(by.id('valorNoche'));
  private inputIdDescripcion = element(by.id('descripcion'));
  private inputIdEstado = element(by.id('estado'));
  private butttonCrearCancha = element(by.id('buttonCrearCancha'));
  private buttonIrActualizarCancha = element(by.id('buttonIrActualizarCancha'));
  private buttonActualizarCancha = element(by.id('buttonActualizarCancha'));

  until: ProtractorExpectedConditions;

  constructor() {
    this.until = ExpectedConditions;
  }

  // navegando
  navigateTo(url): Promise<void> {
    return browser.get(`${browser.baseUrl}${url}`) as Promise<void>;
  }

  async clickCrearCancha() {
    return this.butttonCrearCancha.click();
  }

  async isEnableButtonCrearCancha() {
    return this.butttonCrearCancha.isEnabled();
  }

  async clickIrActualizarCancha() {
    return this.buttonIrActualizarCancha.click();
  }

  async clickActualizarCancha() {
    return this.buttonActualizarCancha.click();
  }

  async contarCanchas() {
    return this.listaCanchas.count();
  }

  async ingresarNombre(nombre) {
    await this.inputIdNombre.sendKeys(nombre);
  }

  async ingresarValorDia(valorDia) {
    await this.inputIdValorDia.sendKeys(valorDia);
  }

  async ingresarValorNoche(valorDia) {
    await this.inputIdValorNoche.sendKeys(valorDia);
  }

  async ingresarEstado(estado) {
    await this.inputIdEstado.sendKeys(estado);
  }

  async ingresarDescripcion(descripcion) {
    await this.inputIdDescripcion.sendKeys(descripcion);
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

  async waitUntilIsPresent(element: ElementFinder): Promise<void> {
    const id = await element.getId()
    return await browser.wait(
      this.until.presenceOf(element),
      5000,
      `Element ${id} taking too long to appear in the DOM`
    );
  }

}
