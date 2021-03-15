import {NgModule} from '@angular/core';
import {SharedModule} from '@shared/shared.module';
import {MatCardModule} from '@angular/material/card';
import {FlexLayoutModule} from '@angular/flex-layout';
import {MatTableModule} from '@angular/material/table';
import {MatButtonModule} from '@angular/material/button';
import {MatTooltipModule} from '@angular/material/tooltip';
import {CurrencyMaskModule} from 'ng2-currency-mask';
import {ReservaRoutingModule} from './reserva.routing.module';
import {ReservaComponent} from './componentes/reserva/reserva.component';
import {ListarReservaComponent} from './componentes/listar-reserva/listar-reserva.component';
import {CrearReservaComponent} from './componentes/crear-reserva/crear-reserva.component';
import {FinalizarReservaComponent} from './componentes/finalizar-reserva/finalizar-reserva.component';
import {CancelarReservaComponent} from './componentes/cancelar-reserva/cancelar-reserva.component';
import {ReservaService} from './shared/service/reserva.service';
import {NgbDatepickerModule} from "@ng-bootstrap/ng-bootstrap";
import {MatDividerModule} from "@angular/material/divider";
import {DatePipe} from "@angular/common";


@NgModule({
  declarations: [
    ReservaComponent,
    ListarReservaComponent,
    CrearReservaComponent,
    FinalizarReservaComponent,
    CancelarReservaComponent
  ],
  imports: [
    ReservaRoutingModule,
    SharedModule,
    MatCardModule,
    MatTableModule,
    FlexLayoutModule,
    MatButtonModule,
    MatTooltipModule,
    CurrencyMaskModule,
    NgbDatepickerModule,
    MatDividerModule
  ],
  providers: [ReservaService, DatePipe]
})
export class ReservaModule {
}
