import { Component, OnInit } from '@angular/core';
import {Reserva} from '../../shared/model/reserva';
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {ReservaService} from "../../shared/service/reserva.service";
import {NgxSpinnerService} from "ngx-spinner";
import {ToastrService} from "ngx-toastr";

@Component({
  selector: 'app-cancelar-reserva',
  templateUrl: './cancelar-reserva.component.html',
  styleUrls: ['./cancelar-reserva.component.scss']
})
export class CancelarReservaComponent implements OnInit {

  reservaCancelar: Reserva;
  constructor(private modalService: NgbModal,
              private reservaService: ReservaService,
              private spinner: NgxSpinnerService,
              private toast: ToastrService) { }

  ngOnInit(): void {
    this.reservaCancelar = JSON.parse(localStorage.getItem('reservaSeleccionada'));
  }

  cancelar() {
    this.modalService.dismissAll('cancelar');
  }
  aceptar() {
    this.spinner.show();
    this.reservaService.cancelar(this.reservaCancelar.id)
      .subscribe(
        () => {
          this.spinner.hide();
          this.toast.success('La reserva ha sido cancelada exitosamente', 'Exito');
          this.modalService.dismissAll('exito');
        });
  }

}
