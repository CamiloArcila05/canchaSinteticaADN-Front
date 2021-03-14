import { NgModule } from '@angular/core';


import { SharedModule } from '@shared/shared.module';
import {ListarCanchaComponent} from './componentes/listar-cancha/listar-cancha.component';
import {CanchaComponent} from './componentes/cancha/cancha.component';
import {CanchaService} from './shared/service/cancha.service';
import {CanchaRoutingModule} from './cancha-routing.module';
import {MatCardModule} from '@angular/material/card';
import {FlexLayoutModule} from '@angular/flex-layout';
import {MatTableModule} from '@angular/material/table';
import {MatButtonModule} from '@angular/material/button';
import {MatTooltipModule} from '@angular/material/tooltip';
import { CrearCanchaComponent } from './componentes/crear-cancha/crear-cancha.component';
import { EditarCanchaComponent } from './componentes/editar-cancha/editar-cancha.component';
import {CurrencyMaskModule} from 'ng2-currency-mask';


@NgModule({
  declarations: [
    ListarCanchaComponent,
    CanchaComponent,
    CrearCanchaComponent,
    EditarCanchaComponent
  ],
  imports: [
    CanchaRoutingModule,
    SharedModule,
    MatCardModule,
    MatTableModule,
    FlexLayoutModule,
    MatButtonModule,
    MatTooltipModule,
    CurrencyMaskModule
  ],
  providers: [CanchaService]
})
export class CanchaModule { }
