import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import {ReservaComponent} from './componentes/reserva/reserva.component';
import {ListarReservaComponent} from './componentes/listar-reserva/listar-reserva.component';
import {CrearReservaComponent} from './componentes/crear-reserva/crear-reserva.component';
import {CancelarReservaComponent} from './componentes/cancelar-reserva/cancelar-reserva.component';
import {FinalizarReservaComponent} from './componentes/finalizar-reserva/finalizar-reserva.component';


const routes: Routes = [
  {
    path: '',
    component: ReservaComponent,
    children: [
      {
        path: '',
        component: ListarReservaComponent
      },
      {
        path: 'crear-reserva',
        component: CrearReservaComponent
      },
      {
        path: 'cancelar-reserva',
        component: CancelarReservaComponent
      },
      {
        path: 'finalizar-reserva',
        component: FinalizarReservaComponent
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ReservaRoutingModule { }
