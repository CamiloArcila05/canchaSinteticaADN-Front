import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import {CanchaComponent} from './componentes/cancha/cancha.component';
import {ListarCanchaComponent} from './componentes/listar-cancha/listar-cancha.component';
import {CrearCanchaComponent} from "./componentes/crear-cancha/crear-cancha.component";
import {EditarCanchaComponent} from "./componentes/editar-cancha/editar-cancha.component";


const routes: Routes = [
  {
    path: '',
    component: CanchaComponent,
    children: [
      {
        path: '',
        component: ListarCanchaComponent
      },
      {
        path: 'crear-cancha',
        component: CrearCanchaComponent
      },
      {
        path: 'actualizar-cancha',
        component: EditarCanchaComponent
      },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CanchaRoutingModule { }
