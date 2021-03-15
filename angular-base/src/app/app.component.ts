import { Component } from '@angular/core';
import { MenuItem } from '@core/modelo/menu-item';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'app-base';
  public companies: MenuItem[] = [
    { url: '/inicio', nombre: 'Inicio' },
    { url: '/cancha', nombre: 'Canchas' },
    { url: '/reserva', nombre: 'Reservas' },
  ];


}
