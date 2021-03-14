import { by, element } from 'protractor';

export class NavbarPage {
    linkHome = element(by.xpath('/html/body/app-root/app-navbar/nav/a[1]'));
    linkCancha = element(by.xpath('/html/body/app-root/app-navbar/nav/a[2]'));
    linkReserva = element(by.xpath('/html/body/app-root/app-navbar/nav/a[3]'));
    linkProducto = element(by.xpath('/html/body/app-root/app-navbar/nav/a[2]'));

    async clickBotonProductos() {
        await this.linkProducto.click();
    }
}
